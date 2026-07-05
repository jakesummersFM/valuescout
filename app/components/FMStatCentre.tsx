'use client';

/**
 * FM Value Scout — Stat Centre
 * Full-screen overlay with two modes:
 *   PLAYER mode  — radar chart, colour-coded stat cards, bar breakdowns, scouting verdict
 *   SQUAD mode   — all shortlisted players compared across every stat with bar charts
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Users, User, TrendingUp, Award, AlertTriangle, Star, Activity, Target } from 'lucide-react';

// ─── Types (mirrors main app) ─────────────────────────────────────────────────

export interface Player {
  id: number;
  name: string;
  age: number;
  position: string;
  league: string;
  valueScore: number;
  transferValue: string;
  transferValueM: number;
  wage: string;
  wageK: number;
  rawData: Record<string, unknown>;
  badge: { type: string; label: string; icon: string };
  perfPercent: number;
  valuePercent: number;
  agePercent: number;
  percentileInLeague?: number;
}

interface Props {
  players: Player[];
  shortlist: Player[];
  initialPlayer?: Player;
  onClose: () => void;
}

// ─── Stat definitions per position ────────────────────────────────────────────

interface StatDef {
  key: string;
  label: string;
  shortLabel: string;
  higherIsBetter: boolean;
  format: (v: number) => string;
  max: number;
  category: 'attack' | 'defense' | 'physical' | 'technical' | 'financial';
}

const STAT_DEFS: Record<string, StatDef[]> = {
  GK: [
    { key: 'Sv %',         label: 'Save %',        shortLabel: 'SV%',  higherIsBetter: true,  format: v => `${v.toFixed(1)}%`, max: 100,  category: 'defense' },
    { key: 'Clean Sheets', label: 'Clean Sheets',  shortLabel: 'CS',   higherIsBetter: true,  format: v => `${v}`,             max: 30,   category: 'defense' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
  'Central Defender': [
    { key: 'Tck C',        label: 'Tackles',        shortLabel: 'TCK',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 80,   category: 'defense' },
    { key: 'Itc',          label: 'Interceptions',  shortLabel: 'ITC',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 60,   category: 'defense' },
    { key: 'Pas %',        label: 'Pass %',         shortLabel: 'PAS%', higherIsBetter: true,  format: v => `${v.toFixed(1)}%`, max: 100,  category: 'technical' },
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 30,   category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
    { key: 'Hdr %',        label: 'Header %',       shortLabel: 'HDR',  higherIsBetter: true,  format: v => `${v.toFixed(1)}%`, max: 100,  category: 'physical' },
  ],
  CDM: [
    { key: 'Tck C',        label: 'Tackles',        shortLabel: 'TCK',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 80,   category: 'defense' },
    { key: 'Itc',          label: 'Interceptions',  shortLabel: 'ITC',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 60,   category: 'defense' },
    { key: 'Pas %',        label: 'Pass %',         shortLabel: 'PAS%', higherIsBetter: true,  format: v => `${v.toFixed(1)}%`, max: 100,  category: 'technical' },
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 40,   category: 'attack' },
    { key: 'Ast',          label: 'Assists',        shortLabel: 'AST',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 15,   category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
  'Wing Back': [
    { key: 'Tck C',        label: 'Tackles',        shortLabel: 'TCK',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 70,   category: 'defense' },
    { key: 'Itc',          label: 'Interceptions',  shortLabel: 'ITC',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 50,   category: 'defense' },
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 40,   category: 'attack' },
    { key: 'Ast',          label: 'Assists',        shortLabel: 'AST',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 15,   category: 'attack' },
    { key: 'Cr C',         label: 'Crosses',        shortLabel: 'CRS',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 80,   category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
  'Centre Mid': [
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 60,   category: 'attack' },
    { key: 'Ast',          label: 'Assists',        shortLabel: 'AST',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 20,   category: 'attack' },
    { key: 'Tck C',        label: 'Tackles',        shortLabel: 'TCK',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 60,   category: 'defense' },
    { key: 'Pas %',        label: 'Pass %',         shortLabel: 'PAS%', higherIsBetter: true,  format: v => `${v.toFixed(1)}%`, max: 100,  category: 'technical' },
    { key: 'Gls',          label: 'Goals',          shortLabel: 'GLS',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 20,   category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
  'Attacking Mid': [
    { key: 'Gls',          label: 'Goals',          shortLabel: 'GLS',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 30,   category: 'attack' },
    { key: 'Ast',          label: 'Assists',        shortLabel: 'AST',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 25,   category: 'attack' },
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 80,   category: 'attack' },
    { key: 'xG',           label: 'xG',             shortLabel: 'XG',   higherIsBetter: true,  format: v => `${v.toFixed(2)}`,  max: 25,   category: 'attack' },
    { key: 'Sh',           label: 'Shots',          shortLabel: 'SH',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 100,  category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
  Winger: [
    { key: 'Gls',          label: 'Goals',          shortLabel: 'GLS',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 25,   category: 'attack' },
    { key: 'Ast',          label: 'Assists',        shortLabel: 'AST',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 20,   category: 'attack' },
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 60,   category: 'attack' },
    { key: 'xG',           label: 'xG',             shortLabel: 'XG',   higherIsBetter: true,  format: v => `${v.toFixed(2)}`,  max: 20,   category: 'attack' },
    { key: 'Cr C',         label: 'Crosses',        shortLabel: 'CRS',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 100,  category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
  Striker: [
    { key: 'Gls',          label: 'Goals',          shortLabel: 'GLS',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 40,   category: 'attack' },
    { key: 'Ast',          label: 'Assists',        shortLabel: 'AST',  higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 20,   category: 'attack' },
    { key: 'xG',           label: 'xG',             shortLabel: 'XG',   higherIsBetter: true,  format: v => `${v.toFixed(2)}`,  max: 35,   category: 'attack' },
    { key: 'Sh',           label: 'Shots',          shortLabel: 'SH',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 120,  category: 'attack' },
    { key: 'Key',          label: 'Key Passes',     shortLabel: 'KP',   higherIsBetter: true,  format: v => `${v.toFixed(1)}`,  max: 40,   category: 'attack' },
    { key: 'Minutes',      label: 'Minutes',        shortLabel: 'MIN',  higherIsBetter: true,  format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
  ],
};

const DEFAULT_STATS: StatDef[] = [
  { key: 'Minutes', label: 'Minutes', shortLabel: 'MIN', higherIsBetter: true, format: v => `${Math.round(v)}`, max: 3600, category: 'physical' },
];

const CATEGORY_COLORS: Record<string, string> = {
  attack:    '#ef4444',
  defense:   '#3b82f6',
  physical:  '#f59e0b',
  technical: '#10b981',
  financial: '#8b5cf6',
};

const CATEGORY_LABELS: Record<string, string> = {
  attack: 'Attack', defense: 'Defence', physical: 'Physical', technical: 'Technical', financial: 'Financial',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRaw(player: Player, key: string): number {
  const v = player.rawData[key] ?? player.rawData[key.toLowerCase()] ?? player.rawData[key.replace(/ /g, '')];
  if (v === undefined) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function getStatDefs(position: string): StatDef[] {
  return STAT_DEFS[position] ?? DEFAULT_STATS;
}

function scoreColor(s: number) {
  if (s >= 85) return '#10b981'; if (s >= 75) return '#8b5cf6';
  if (s >= 65) return '#f59e0b'; return '#ef4444';
}

function statRating(value: number, max: number, higherIsBetter: boolean): 'elite' | 'good' | 'average' | 'poor' {
  const pct = higherIsBetter ? value / max : 1 - (value / max);
  if (pct >= 0.75) return 'elite';
  if (pct >= 0.5)  return 'good';
  if (pct >= 0.25) return 'average';
  return 'poor';
}

const RATING_COLORS = { elite:'#10b981', good:'#8b5cf6', average:'#f59e0b', poor:'#ef4444' };
const RATING_BG     = { elite:'rgba(16,185,129,0.1)', good:'rgba(139,92,246,0.1)', average:'rgba(245,158,11,0.1)', poor:'rgba(239,68,68,0.1)' };
const RATING_LABELS = { elite:'Elite', good:'Good', average:'Average', poor:'Poor' };

// ─── Radar Chart (SVG polygon) ────────────────────────────────────────────────

function RadarChart({ player, compareTo, size = 300 }: { player: Player; compareTo?: Player; size?: number }) {
  const stats  = getStatDefs(player.position);
  const cx     = size / 2, cy = size / 2, r = size * 0.38;
  const n      = stats.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const points = (p: Player) =>
    stats.map((stat, i) => {
      const angle = startAngle + i * angleStep;
      const raw   = getRaw(p, stat.key);
      const pct   = Math.min(1, raw / stat.max);
      return { x: cx + r * pct * Math.cos(angle), y: cy + r * pct * Math.sin(angle) };
    });

  const axisPoints = stats.map((_, i) => {
    const angle = startAngle + i * angleStep;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const labelPoints = stats.map((stat, i) => {
    const angle  = startAngle + i * angleStep;
    const dist   = r + 22;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), label: stat.shortLabel, col: CATEGORY_COLORS[stat.category] };
  });

  const playerPts  = points(player);
  const comparePts = compareTo ? points(compareTo) : null;

  const rings = [0.25, 0.5, 0.75, 1].map(t =>
    stats.map((_, i) => {
      const angle = startAngle + i * angleStep;
      return { x: cx + r * t * Math.cos(angle), y: cy + r * t * Math.sin(angle) };
    })
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: 'auto', maxWidth: size }}>
      {rings.map((ring, ri) => (
        <polygon key={ri} points={ring.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {axisPoints.map((pt, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}
      {comparePts && (
        <polygon points={comparePts.map(p => `${p.x},${p.y}`).join(' ')}
          fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 2" />
      )}
      <polygon points={playerPts.map(p => `${p.x},${p.y}`).join(' ')}
        fill="rgba(16,185,129,0.18)" stroke="#10b981" strokeWidth={2} />
      {playerPts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill="#10b981" stroke="#0A0714" strokeWidth={1.5} />
      ))}
      {labelPoints.map((lp, i) => (
        <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fill={lp.col} fontWeight={700} letterSpacing={0.5} fontFamily="monospace">
          {lp.label}
        </text>
      ))}
      <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ stat, value, allValues, animated }: {
  stat: StatDef; value: number; allValues: number[]; animated?: boolean;
}) {
  const rating  = statRating(value, stat.max, stat.higherIsBetter);
  const pct     = Math.min(100, (value / stat.max) * 100);
  const catColor= CATEGORY_COLORS[stat.category];
  const sorted  = [...allValues].sort((a, b) => b - a);
  const rank    = sorted.indexOf(value) + 1;
  const total   = sorted.length;

  return (
    <div style={{
      background: RATING_BG[rating],
      border: `0.5px solid ${RATING_COLORS[rating]}30`,
      borderRadius: 10, padding: '12px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:catColor, borderRadius:'10px 0 0 10px' }} />
      <div style={{ paddingLeft: 6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
          <div style={{ fontSize:10, color:'#71717a', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>{stat.label}</div>
          <span style={{ fontSize:10, background:RATING_BG[rating], color:RATING_COLORS[rating], padding:'1px 7px', borderRadius:99, fontWeight:700 }}>{RATING_LABELS[rating]}</span>
        </div>
        <div style={{ fontSize:24, fontWeight:700, fontFamily:'monospace', color:RATING_COLORS[rating], lineHeight:1, marginBottom:8 }}>
          {stat.format(value)}
        </div>
        <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, marginBottom:6, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:catColor, borderRadius:99, transition:animated?'width 0.6s ease':undefined }} />
        </div>
        {total > 1 && (
          <div style={{ fontSize:10, color:'#52525b' }}>
            Rank <strong style={{ color:'#a1a1aa' }}>#{rank}</strong> of {total} in dataset
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Horizontal Bar (for squad comparison) ────────────────────────────────────

function CompareBar({ player, stat, maxVal, isHighlight }: {
  player: Player; stat: StatDef; maxVal: number; isHighlight: boolean;
}) {
  const value = getRaw(player, stat.key);
  const pct   = maxVal > 0 ? Math.min(100, (value / maxVal) * 100) : 0;
  const col   = isHighlight ? CATEGORY_COLORS[stat.category] : 'rgba(139,92,246,0.5)';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0' }}>
      <div style={{ width:130, fontSize:12, fontWeight: isHighlight ? 600 : 400, color: isHighlight ? '#f4f4f5' : '#71717a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'right' }}>{player.name.split(' ').slice(-1)[0]}</div>
      <div style={{ flex:1, height:18, background:'rgba(255,255,255,0.04)', borderRadius:4, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background:col, borderRadius:4, transition:'width 0.5s ease' }} />
        <div style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', fontSize:10, fontFamily:'monospace', fontWeight:700, color: pct > 60 ? '#fff' : '#a1a1aa' }}>
          {stat.format(value)}
        </div>
      </div>
    </div>
  );
}

// ─── Scouting Verdict ─────────────────────────────────────────────────────────

function ScoutingVerdict({ player }: { player: Player }) {
  const stats   = getStatDefs(player.position);
  const ratings = stats.map(s => statRating(getRaw(player, s.key), s.max, s.higherIsBetter));
  const elite   = ratings.filter(r => r === 'elite').length;
  const poor    = ratings.filter(r => r === 'poor').length;
  const score   = player.valueScore;

  let headline = '', body = '', icon: React.ReactNode, color = '';

  if (score >= 85 && elite >= 2) {
    headline = 'Exceptional signing'; color = '#10b981'; icon = <Award size={16} />;
    body = `${player.name} is among the top performers in this dataset. Elite stats back up the high Value Score — sign immediately if within budget.`;
  } else if (score >= 75 && poor === 0) {
    headline = 'Solid acquisition'; color = '#8b5cf6'; icon = <TrendingUp size={16} />;
    body = `A reliable, well-rounded player. No glaring weaknesses in the stats. Good value at the listed price.`;
  } else if (score >= 75 && player.transferValueM < 10) {
    headline = 'Hidden gem'; color = '#10b981'; icon = <Star size={16} />;
    body = `High performance at a low price tag — exactly the kind of Moneyball signing that wins titles. Move quickly.`;
  } else if (score < 65 && player.transferValueM > 20) {
    headline = 'Avoid'; color = '#ef4444'; icon = <AlertTriangle size={16} />;
    body = `The numbers don't justify the asking price. Look elsewhere unless you have specific tactical reasons.`;
  } else if (poor >= 2) {
    headline = 'Needs development'; color = '#f59e0b'; icon = <Activity size={16} />;
    body = `Several weak areas show up in the data. Could work as a squad player or for a lower league, but requires work.`;
  } else {
    headline = 'Viable option'; color = '#f59e0b'; icon = <Target size={16} />;
    body = `Decent across the board without truly standing out. Negotiate the price down before committing.`;
  }

  return (
    <div style={{ background:`${color}10`, border:`0.5px solid ${color}40`, borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, color }}>
        {icon}
        <span style={{ fontWeight:700, fontSize:14 }}>{headline}</span>
      </div>
      <div style={{ fontSize:13, color:'#a1a1aa', lineHeight:1.7 }}>{body}</div>
      <div style={{ display:'flex', gap:10, marginTop:12 }}>
        {[
          { label:`${elite} Elite stats`, color:'#10b981' },
          { label:`${ratings.filter(r=>r==='good').length} Good`, color:'#8b5cf6' },
          { label:`${poor} Poor`, color:'#ef4444' },
        ].map(({ label, color: c }) => (
          <span key={label} style={{ fontSize:11, background:`${c}15`, color:c, padding:'2px 10px', borderRadius:99, fontWeight:600 }}>{label}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Player Deep-Dive ─────────────────────────────────────────────────────────

function PlayerMode({ player, allPlayers }: {
  player: Player; allPlayers: Player[];
}) {
  const stats     = getStatDefs(player.position);
  const samePos   = allPlayers.filter(p => p.position === player.position && p.id !== player.id);
  const [compareId, setCompareId] = useState<number | null>(null);
  const compareTo = compareId ? allPlayers.find(p => p.id === compareId) : undefined;

  const allValuesMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    stats.forEach(s => { map[s.key] = allPlayers.map(p => getRaw(p, s.key)); });
    return map;
  }, [allPlayers, stats]);

  const byCategory = useMemo(() => {
    const cats: Record<string, StatDef[]> = {};
    stats.forEach(s => { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });
    return cats;
  }, [stats]);

  // Reset compare when player changes
  React.useEffect(() => { setCompareId(null); }, [player.id]);

  return (
    <div style={{ display:'flex', gap:24, height:'100%', overflow:'hidden' }}>
      {/* Left — radar + identity */}
      <div style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column', gap:16, overflowY:'auto', paddingRight:4 }}>
        {/* Identity */}
        <div style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:14, padding:'18px 20px' }}>
          <div style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.5px', marginBottom:3 }}>{player.name}</div>
          <div style={{ fontSize:12, color:'#8b5cf6', marginBottom:12 }}>{player.position} · {player.league} · Age {player.age}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[
              { label:'Score', value:player.valueScore, color:scoreColor(player.valueScore) },
              { label:'Value', value:player.transferValue, color:'#f59e0b' },
              { label:'Wage',  value:player.wage,          color:'#71717a' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign:'center', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'8px 4px' }}>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
                <div style={{ fontSize:10, color:'#52525b', marginTop:2, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
              </div>
            ))}
          </div>
          {player.badge.icon && (
            <div style={{ marginTop:10, fontSize:12, color:'#a78bfa', display:'flex', alignItems:'center', gap:5 }}>
              {player.badge.icon} {player.badge.label}
            </div>
          )}
          {player.percentileInLeague !== undefined && (
            <div style={{ marginTop:8, fontSize:11, color:'#52525b' }}>
              Top <strong style={{ color:'#a1a1aa' }}>{100 - player.percentileInLeague}%</strong> in {player.league}
            </div>
          )}
        </div>

        {/* Score breakdown bars */}
        <div style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Score Breakdown</div>
          {[
            { label:'Performance',  value:player.perfPercent,  color:'#10b981' },
            { label:'Value/money',  value:player.valuePercent, color:'#8b5cf6' },
            { label:'Age factor',   value:player.agePercent,   color:'#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                <span style={{ color:'#71717a' }}>{label}</span>
                <span style={{ fontFamily:'monospace', color, fontWeight:600 }}>{value}%</span>
              </div>
              <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:99 }}>
                <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:99 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Radar */}
        <div style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em' }}>Radar</div>
            {compareTo && <div style={{ fontSize:10, color:'#8b5cf6' }}>vs {compareTo.name.split(' ').slice(-1)[0]}</div>}
          </div>
          <RadarChart player={player} compareTo={compareTo} size={260} />
          <div style={{ display:'flex', gap:12, marginTop:8, justifyContent:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#10b981' }}>
              <div style={{ width:12, height:2, background:'#10b981' }} /> {player.name.split(' ').slice(-1)[0]}
            </div>
            {compareTo && (
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#8b5cf6' }}>
                <div style={{ width:12, height:2, background:'#8b5cf6', borderTop:'2px dashed #8b5cf6' }} /> {compareTo.name.split(' ').slice(-1)[0]}
              </div>
            )}
          </div>
        </div>

        {/* Compare vs picker */}
        {samePos.length > 0 && (
          <div style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Compare radar vs</div>
            <select value={compareId ?? ''} onChange={e => setCompareId(e.target.value ? parseInt(e.target.value) : null)}
              style={{ width:'100%', background:'rgba(10,7,20,0.8)', border:'0.5px solid rgba(139,92,246,0.3)', borderRadius:7, color:'#e4e4e7', fontSize:12, padding:'7px 10px' }}>
              <option value="">None</option>
              {samePos.map(p => <option key={p.id} value={p.id}>{p.name} ({p.valueScore})</option>)}
            </select>
          </div>
        )}

        {/* Scouting verdict */}
        <ScoutingVerdict player={player} />
      </div>

      {/* Right — stat cards by category + raw data */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:20 }}>
        {Object.entries(byCategory).map(([cat, catStats]) => (
          <div key={cat}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <div style={{ width:10, height:10, borderRadius:99, background:CATEGORY_COLORS[cat] }} />
              <div style={{ fontSize:12, fontWeight:700, color:CATEGORY_COLORS[cat], textTransform:'uppercase', letterSpacing:'0.08em' }}>{CATEGORY_LABELS[cat]}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10 }}>
              {catStats.map(stat => (
                <StatCard
                  key={stat.key}
                  stat={stat}
                  value={getRaw(player, stat.key)}
                  allValues={allValuesMap[stat.key] ?? []}
                  animated
                />
              ))}
            </div>
          </div>
        ))}

        {/* All raw exported stats */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>All Exported Stats</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:7 }}>
            {Object.entries(player.rawData).map(([key, val]) => (
              <div key={key} style={{ background:'rgba(255,255,255,0.02)', border:'0.5px solid rgba(139,92,246,0.08)', borderRadius:7, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:'#3f3f46', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>{key}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#e4e4e7' }}>{String(val)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Squad Overview ───────────────────────────────────────────────────────────

function SquadMode({ shortlist, onSelectPlayer }: {
  shortlist: Player[]; onSelectPlayer: (p: Player) => void;
}) {
  const [posFilter, setPosFilter] = useState('All');
  const [sortStat,  setSortStat]  = useState('valueScore');

  const visible = useMemo(() =>
    (posFilter === 'All' ? shortlist : shortlist.filter(p => p.position === posFilter))
      .sort((a, b) => {
        if (sortStat === 'valueScore') return b.valueScore - a.valueScore;
        if (sortStat === 'age') return a.age - b.age;
        if (sortStat === 'value') return a.transferValueM - b.transferValueM;
        return b.valueScore - a.valueScore;
      }),
    [shortlist, posFilter, sortStat]);

  const positions = useMemo(() => ['All', ...Array.from(new Set(shortlist.map(p => p.position)))], [shortlist]);

  if (shortlist.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#52525b' }}>
        <Users size={48} style={{ opacity:0.2 }} />
        <div style={{ fontSize:16, color:'#71717a' }}>No players shortlisted</div>
        <div style={{ fontSize:13 }}>Add players from the main table first</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Controls */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6 }}>
          {positions.map(pos => (
            <button key={pos} onClick={() => setPosFilter(pos)} style={{
              padding:'5px 12px', borderRadius:99, border:'none', cursor:'pointer', fontSize:11, fontWeight:500,
              background: posFilter === pos ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
              color: posFilter === pos ? '#c4b5fd' : '#71717a',
            }}>{pos === 'All' ? 'All positions' : pos}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#52525b' }}>Sort by:</span>
          {[['valueScore','Score'],['age','Age'],['value','Value']].map(([k,l]) => (
            <button key={k} onClick={() => setSortStat(k)} style={{
              padding:'4px 10px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11,
              background: sortStat === k ? '#7c3aed' : 'transparent',
              color: sortStat === k ? 'white' : '#71717a',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexShrink:0 }}>
        {[
          { label:'Players', value:visible.length },
          { label:'Avg score', value:visible.length ? Math.round(visible.reduce((s,p)=>s+p.valueScore,0)/visible.length) : 0 },
          { label:'Avg age', value:visible.length ? (visible.reduce((s,p)=>s+p.age,0)/visible.length).toFixed(1) : 0 },
          { label:'Gems', value:`${visible.filter(p=>p.badge.type==='gem').length} 💎` },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(139,92,246,0.15)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color:'#e4e4e7' }}>{value}</div>
            <div style={{ fontSize:10, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Main comparison area */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:24 }}>
        {/* Player cards row */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Shortlist Overview</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
            {visible.map(p => (
              <div key={p.id} onClick={() => onSelectPlayer(p)} style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(139,92,246,0.15)', borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.15)')}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{p.name}</div>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:scoreColor(p.valueScore), marginLeft:8 }}>{p.valueScore}</span>
                </div>
                <div style={{ fontSize:11, color:'#71717a', marginBottom:8 }}>{p.position} · {p.age}y</div>
                <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:99 }}>
                  <div style={{ height:'100%', width:`${((p.valueScore-48)/(97-48))*100}%`, background:scoreColor(p.valueScore), borderRadius:99 }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#52525b', marginTop:5 }}>
                  <span>{p.transferValue}</span>
                  {p.badge.icon && <span>{p.badge.icon}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stat comparison bars */}
        {(() => {
          const allStatKeys = new Set<string>();
          const statDefMap: Record<string, StatDef> = {};
          visible.forEach(p => {
            getStatDefs(p.position).forEach(s => { allStatKeys.add(s.key); statDefMap[s.key] = s; });
          });

          return Array.from(allStatKeys).map(key => {
            const stat   = statDefMap[key];
            const values = visible.map(p => getRaw(p, key));
            const maxVal = Math.max(...values, 0.001);
            const best   = visible.reduce((b, p) => getRaw(p, key) > getRaw(b, key) ? p : b, visible[0]);

            return (
              <div key={key}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:99, background:CATEGORY_COLORS[stat.category] }} />
                  <div style={{ fontSize:12, fontWeight:600, color:'#a1a1aa' }}>{stat.label}</div>
                  <span style={{ fontSize:10, color:CATEGORY_COLORS[stat.category], marginLeft:'auto' }}>Best: {best.name.split(' ').slice(-1)[0]} ({stat.format(getRaw(best, key))})</span>
                </div>
                {visible.map(p => (
                  <CompareBar key={p.id} player={p} stat={stat} maxVal={maxVal} isHighlight={p.id === best.id} />
                ))}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

// ─── Main Stat Centre ─────────────────────────────────────────────────────────

export default function FMStatCentre({ players, shortlist, initialPlayer, onClose }: Props) {
  const [mode,   setMode]   = useState<'player' | 'squad'>(initialPlayer ? 'player' : 'squad');
  const [player, setPlayer] = useState<Player | null>(initialPlayer ?? shortlist[0] ?? players[0] ?? null);
  const [search, setSearch] = useState('');

  const playerList = useMemo(() =>
    players.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [players, search]);

  const currentIdx = player ? players.findIndex(p => p.id === player.id) : -1;
  const prevPlayer = currentIdx > 0 ? players[currentIdx - 1] : null;
  const nextPlayer = currentIdx < players.length - 1 ? players[currentIdx + 1] : null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft'  && prevPlayer) setPlayer(prevPlayer);
      if (e.key === 'ArrowRight' && nextPlayer) setPlayer(nextPlayer);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [prevPlayer, nextPlayer, onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#08050f',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'IBM Plex Mono', 'Fira Code', 'Consolas', monospace",
      color: '#e4e4e7',
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 24px', height: 56, flexShrink: 0,
        borderBottom: '0.5px solid rgba(139,92,246,0.2)',
        background: 'rgba(8,5,15,0.98)',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>VS</div>
          <span style={{ fontSize:13, fontWeight:700, letterSpacing:'-0.3px', color:'#f4f4f5' }}>Stat Centre</span>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:3, marginLeft:8 }}>
          {([['player','Player'],['squad','Squad']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:'5px 16px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12,
              background: mode === m ? '#7c3aed' : 'transparent',
              color:      mode === m ? 'white'   : '#71717a',
              fontFamily:'inherit', display:'flex', alignItems:'center', gap:6,
            }}>
              {m === 'player' ? <User size={12}/> : <Users size={12}/>} {label}
            </button>
          ))}
        </div>

        {/* Player navigation (player mode only) */}
        {mode === 'player' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:8 }}>
            <button onClick={() => prevPlayer && setPlayer(prevPlayer)} disabled={!prevPlayer} style={{ background:'none', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:6, padding:'4px 8px', cursor:prevPlayer?'pointer':'not-allowed', color:prevPlayer?'#a1a1aa':'#3f3f46', opacity:prevPlayer?1:0.4, fontFamily:'inherit' }}>
              <ChevronLeft size={14}/>
            </button>
            <div style={{ position:'relative' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player…" style={{ padding:'5px 10px', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(139,92,246,0.25)', borderRadius:7, color:'#e4e4e7', fontSize:12, outline:'none', width:200, fontFamily:'inherit' }}/>
              {search && (
                <div style={{ position:'absolute', top:'100%', left:0, width:260, background:'#0c0818', border:'0.5px solid rgba(139,92,246,0.3)', borderRadius:8, zIndex:50, maxHeight:200, overflowY:'auto', marginTop:4 }}>
                  {playerList.slice(0,10).map(p => (
                    <div key={p.id} onClick={() => { setPlayer(p); setSearch(''); }} style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, display:'flex', justifyContent:'space-between' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(124,58,237,0.12)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <span>{p.name}</span>
                      <span style={{ color:scoreColor(p.valueScore), fontWeight:700 }}>{p.valueScore}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => nextPlayer && setPlayer(nextPlayer)} disabled={!nextPlayer} style={{ background:'none', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:6, padding:'4px 8px', cursor:nextPlayer?'pointer':'not-allowed', color:nextPlayer?'#a1a1aa':'#3f3f46', opacity:nextPlayer?1:0.4, fontFamily:'inherit' }}>
              <ChevronRight size={14}/>
            </button>
            <span style={{ fontSize:11, color:'#52525b' }}>← → to navigate</span>
          </div>
        )}

        {/* Category legend */}
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center' }}>
          {Object.entries(CATEGORY_COLORS).filter(([k])=>k!=='financial').map(([cat,col]) => (
            <div key={cat} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:99, background:col }} />
              <span style={{ fontSize:10, color:'#52525b' }}>{CATEGORY_LABELS[cat]}</span>
            </div>
          ))}
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#52525b', padding:4, display:'flex', alignItems:'center', marginLeft:8 }}>
            <X size={18}/>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex:1, overflow:'hidden', padding:'20px 24px' }}>
        {mode === 'player' ? (
          player ? (
            <PlayerMode
              player={player}
              allPlayers={players}
            />
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#52525b' }}>
              <User size={48} style={{ opacity:0.2 }} />
              <div style={{ fontSize:16, color:'#71717a' }}>No player selected</div>
              <div style={{ fontSize:13 }}>Search for a player above or upload a CSV first</div>
            </div>
          )
        ) : (
          <SquadMode shortlist={shortlist} onSelectPlayer={p => { setPlayer(p); setMode('player'); }} />
        )}
      </div>

      {/* ── Footer hint ── */}
      <div style={{ padding:'8px 24px', borderTop:'0.5px solid rgba(255,255,255,0.04)', display:'flex', gap:20, fontSize:10, color:'#3f3f46', flexShrink:0 }}>
        {[['Esc','Close'],['← →','Navigate players'],['Click player card','Switch to player view']].map(([key,label]) => (
          <span key={key}><code style={{ background:'rgba(255,255,255,0.05)', padding:'1px 6px', borderRadius:4, fontFamily:'monospace' }}>{key}</code> {label}</span>
        ))}
        <span style={{ marginLeft:'auto' }}>FM Value Scout V5 · Stat Centre</span>
      </div>
    </div>
  );
}
