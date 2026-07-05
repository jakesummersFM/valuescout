'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, X, BarChart3, FileText,
  Users, HelpCircle, Trash2, Copy, ChevronUp,
  ChevronDown, Star, Eye, AlertCircle,
  CheckCircle, LayoutGrid, List, Target, Zap, DollarSign, Filter
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  SortingState, flexRender, ColumnDef
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface Player {
  id: number;
  rank: number;
  name: string;
  nationality: string;
  age: number;
  position: string;
  league: string;
  valueScore: number;
  keyStat: string;
  transferValue: string;
  wage: string;
  rawData: Record<string, unknown>;
  badge: { type: 'gem' | 'overpriced' | 'overrated' | 'avoid' | 'bargain' | 'none'; label: string; icon: string };
  perfPercent: number;
  valuePercent: number;
  agePercent: number;
  p90Stats: P90StatsType;
}

interface P90StatsType {
  goalsP90: number;
  assistsP90: number;
  xGP90: number;
  xAP90: number;
  keyPassesP90: number;
  shotP90: number;
  tacklesP90: number;
  interceptionsP90: number;
  passCompletion: number;
  savePct: number;
  cleanSheetsP90: number;
  minutesPlayed: number;
  appearances: number;
  costPerGoal: number;
  costPerAssist: number;
  moneyballIndex: number;
}

type Tab = 'upload' | 'data-hub' | 'squad' | 'compare' | 'guide';

interface ParsedCSVRow {
  [key: string]: string | number | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const POSITION_FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'GK', value: 'GK', description: 'Goalkeeper' },
  { label: 'CB', value: 'Central Defender', description: 'Center Back' },
  { label: 'FB', value: 'Wing Back', description: 'Fullback / Wing-Back' },
  { label: 'CDM', value: 'CDM', description: 'Defensive Midfielder' },
  { label: 'CM', value: 'Centre Mid', description: 'Central Midfielder' },
  { label: 'CAM', value: 'Attacking Mid', description: 'Attacking Midfielder' },
  { label: 'Winger', value: 'Winger', description: 'Winger / Wide Player' },
  { label: 'ST', value: 'Striker', description: 'Striker / Forward' },
];

const FORMATION_SLOTS: Record<string, { label: string; position: string }[]> = {
  '4-3-3': [
    { label: 'GK', position: 'GK' },
    { label: 'RB', position: 'Wing Back' }, { label: 'CB', position: 'Central Defender' },
    { label: 'CB', position: 'Central Defender' }, { label: 'LB', position: 'Wing Back' },
    { label: 'CM', position: 'Centre Mid' }, { label: 'CDM', position: 'CDM' }, { label: 'CM', position: 'Centre Mid' },
    { label: 'RW', position: 'Winger' }, { label: 'ST', position: 'Striker' }, { label: 'LW', position: 'Winger' },
  ],
  '4-4-2': [
    { label: 'GK', position: 'GK' },
    { label: 'RB', position: 'Wing Back' }, { label: 'CB', position: 'Central Defender' },
    { label: 'CB', position: 'Central Defender' }, { label: 'LB', position: 'Wing Back' },
    { label: 'RM', position: 'Winger' }, { label: 'CM', position: 'Centre Mid' },
    { label: 'CM', position: 'Centre Mid' }, { label: 'LM', position: 'Winger' },
    { label: 'ST', position: 'Striker' }, { label: 'ST', position: 'Striker' },
  ],
  '3-5-2': [
    { label: 'GK', position: 'GK' },
    { label: 'CB', position: 'Central Defender' }, { label: 'CB', position: 'Central Defender' }, { label: 'CB', position: 'Central Defender' },
    { label: 'RWB', position: 'Wing Back' }, { label: 'CM', position: 'Centre Mid' }, { label: 'CDM', position: 'CDM' },
    { label: 'CM', position: 'Centre Mid' }, { label: 'LWB', position: 'Wing Back' },
    { label: 'ST', position: 'Striker' }, { label: 'ST', position: 'Striker' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getPositionGroup(pos: string): string {
  const p = (pos || '').toLowerCase().trim();
  if (p.includes('gk') || p === 'goalkeeper') return 'GK';
  if (p.includes('wing back') || p.includes('wb') || p.includes('fullback')) return 'Wing Back';
  if (p.includes('d (c)') || p.includes('cb') || p.includes('centre def') || p.includes('center def')) return 'Central Defender';
  if (p.includes('dm') || p.includes('d m')) return 'CDM';
  if (p.includes('am') || p.includes('attacking mid') || p.includes('a m')) return 'Attacking Mid';
  if (p.includes('cm') || p.includes('c m') || p.includes('centre mid')) return 'Centre Mid';
  if (p.includes('winger') || p.includes('rw') || p.includes('lw') || p.includes('m/am') || p.includes('wide')) return 'Winger';
  if (p.includes('st') || p.includes('cf') || p.includes('fw') || p.includes('striker')) return 'Striker';
  return 'Central Defender';
}

function getLeagueMultiplier(league: string): number {
  if (!league) return 1.0;
  const l = (league || '').toLowerCase();
  if (['premier', 'bundesliga', 'la liga', 'serie a', 'ligue 1'].some(s => l.includes(s))) return 1.25;
  if (l.includes('championship') || l.includes('segunda') || l.includes('serie b') || l.includes('segunda división')) return 1.12;
  return 1.0;
}

function parseNum(row: Record<string, unknown>, keys: string[], def = 0): number {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/ /g, '')];
    if (val === null || val === undefined || val === '') continue;
    
    const str = String(val).trim();
    if (!str) continue;
    
    const n = parseFloat(str.replace(/[^0-9.-]/g, ''));
    if (!isNaN(n) && isFinite(n)) return Math.max(0, n);
  }
  return def;
}

function calculateP90Stats(row: Record<string, unknown>, position: string, transferValue: number): P90StatsType {
  const minutes = Math.max(1, parseNum(row, ['Minutes', 'Mins', 'Min'], 90));
  const apps = Math.max(1, parseNum(row, ['Apps', 'Appearances'], 1));
  const per90 = (s: number) => (minutes > 0 ? (s / minutes) * 90 : s);

  const goals = parseNum(row, ['Goals', 'Gls']);
  const assists = parseNum(row, ['Assists', 'Ast']);
  const wage = parseNum(row, ['Wage'], 1000) / 1000;

  const goalsP90 = parseFloat(per90(goals).toFixed(2));
  const assistsP90 = parseFloat(per90(assists).toFixed(2));
  const xGP90 = parseFloat(per90(parseNum(row, ['xG'])).toFixed(2));
  const xAP90 = parseFloat(per90(parseNum(row, ['xA'])).toFixed(2));
  const keyPassesP90 = parseFloat(per90(parseNum(row, ['Key Passes', 'KP', 'Key'])).toFixed(2));
  const shotP90 = parseFloat(per90(parseNum(row, ['Shots', 'Sh'])).toFixed(2));
  const tacklesP90 = parseFloat(per90(parseNum(row, ['Tackles', 'Tck C', 'Tck'])).toFixed(2));
  const interceptionsP90 = parseFloat(per90(parseNum(row, ['Interceptions', 'Itc'])).toFixed(2));
  const passCompletion = parseNum(row, ['Pas %', 'Pass %'], 80);
  const savePct = parseNum(row, ['Sv %', 'Save %'], 0);
  const cleanSheetsP90 = parseFloat(per90(parseNum(row, ['Clean Sheets', 'CS'])).toFixed(2));

  const costPerGoal = goals > 0 ? Math.round((transferValue * 1000000) / goals) : 0;
  const costPerAssist = assists > 0 ? Math.round((transferValue * 1000000) / assists) : 0;
  const performanceSum = Math.max(0.01, goalsP90 + assistsP90 + keyPassesP90);
  const costSum = Math.max(0.01, transferValue * 0.5 + wage * 0.5);
  const moneyballIndex = parseFloat((performanceSum / costSum).toFixed(2));

  return {
    goalsP90, assistsP90, xGP90, xAP90, keyPassesP90, shotP90,
    tacklesP90, interceptionsP90, passCompletion, savePct, cleanSheetsP90,
    minutesPlayed: minutes,
    appearances: apps,
    costPerGoal,
    costPerAssist,
    moneyballIndex: Math.min(moneyballIndex, 9.99),
  };
}

function calculateValueScore(row: Record<string, unknown>, position: string, league: string, balanced: boolean) {
  try {
    const minutes = Math.max(1, parseNum(row, ['Minutes', 'Mins', 'Min'], 90));
    const per90 = (s: number) => (minutes > 0 ? (s / minutes) * 90 : s);

    const goalsP90 = Math.max(0, per90(parseNum(row, ['Goals', 'Gls'])));
    const assistsP90 = Math.max(0, per90(parseNum(row, ['Assists', 'Ast'])));
    const xGP90 = Math.max(0, per90(parseNum(row, ['xG'])));
    const keyPassesP90 = Math.max(0, per90(parseNum(row, ['Key Passes', 'KP', 'Key'])));
    const shotsP90 = Math.max(0, per90(parseNum(row, ['Shots', 'Sh'])));
    const tacklesP90 = Math.max(0, per90(parseNum(row, ['Tackles', 'Tck C', 'Tck'])));
    const interceptionsP90 = Math.max(0, per90(parseNum(row, ['Interceptions', 'Itc'])));
    const passCompletion = Math.min(100, Math.max(0, parseNum(row, ['Pas %', 'Pass %'], 80)));
    const savePct = Math.min(100, Math.max(0, parseNum(row, ['Sv %', 'Save %'], 0)));
    const cleanSheetsP90 = Math.max(0, per90(parseNum(row, ['Clean Sheets', 'CS'])));

    let performance = 0;
    if (position === 'GK') {
      performance = (savePct * 0.7) + (cleanSheetsP90 * 8) + (passCompletion * 0.15);
    } else if (position === 'Central Defender') {
      performance = (tacklesP90 * 2.5) + (interceptionsP90 * 2.8) + (passCompletion * 0.3) + (keyPassesP90 * 0.8);
    } else if (position === 'CDM') {
      performance = (tacklesP90 * 2.2) + (interceptionsP90 * 2.5) + (keyPassesP90 * 1.3) + (passCompletion * 0.4);
    } else if (position === 'Wing Back') {
      performance = (tacklesP90 * 2.0) + (interceptionsP90 * 1.8) + (assistsP90 * 2.5) + (keyPassesP90 * 1.2) + (passCompletion * 0.3);
    } else if (position === 'Centre Mid') {
      performance = (keyPassesP90 * 1.8) + (assistsP90 * 2.2) + (tacklesP90 * 1.5) + (passCompletion * 0.4);
    } else if (position === 'Attacking Mid') {
      performance = (goalsP90 * 3.5) + (assistsP90 * 2.8) + (keyPassesP90 * 2.0) + (shotsP90 * 1.2) + (xGP90 * 1.5);
    } else if (position === 'Winger') {
      performance = (goalsP90 * 3.2) + (assistsP90 * 3.0) + (keyPassesP90 * 1.8) + (shotsP90 * 1.3) + (xGP90 * 1.2);
    } else if (position === 'Striker') {
      performance = (goalsP90 * 4.0) + (xGP90 * 1.8) + (shotsP90 * 1.4) + (assistsP90 * 1.5) + (keyPassesP90 * 0.8);
    }

    performance = Math.max(0, performance);

    const leagueMultiplier = getLeagueMultiplier(league);
    const valueM = Math.max(0.1, parseNum(row, ['Transfer Value'], 0.5));
    const wageK = Math.max(0.1, (parseNum(row, ['Wage'], 1000)) / 1000);
    const efficiency = Math.min(45, Math.max(20, 88 / (valueM * 0.45 + wageK * 0.55)));

    const age = Math.max(16, Math.min(40, parseInt(String(row.Age ?? 25)) || 25));
    let ageBonus = 0;
    if (age <= 20) ageBonus = 18;
    else if (age <= 22) ageBonus = 14;
    else if (age <= 24) ageBonus = 10;
    else if (age <= 26) ageBonus = 6;
    else if (age <= 28) ageBonus = 2;
    else if (age >= 33) ageBonus = -15;
    else if (age >= 31) ageBonus = -8;

    let minutesFactor = 1.0;
    if (minutes < 500) minutesFactor = 0.55;
    else if (minutes < 900) minutesFactor = 0.75;
    else if (minutes < 1400) minutesFactor = 0.92;

    const baseScore = performance * 2.2;
    let final = ((baseScore * 0.58) + (efficiency * 0.32) + (ageBonus * 0.1)) * minutesFactor * leagueMultiplier;
    if (balanced) final *= 0.92;

    const score = Math.max(46, Math.min(100, Math.round(final)));
    const denom = Math.max(1, final);

    return {
      score,
      perfPercent: Math.min(100, Math.max(0, Math.round((baseScore * 0.58 / denom) * 100))) || 65,
      valuePercent: Math.min(100, Math.max(0, Math.round((efficiency * 0.32 / denom) * 100))) || 60,
      agePercent: Math.min(100, Math.max(0, Math.round((Math.abs(ageBonus * 0.1) / denom) * 100))) || 45,
    };
  } catch {
    return { score: 50, perfPercent: 50, valuePercent: 50, agePercent: 50 };
  }
}

function calculateBadge(score: number, valueM: number, age: number, minutes: number, moneyballIndex: number): Player['badge'] {
  if (score >= 88 && age <= 23 && minutes > 900) {
    return { type: 'gem', label: 'Hidden Gem', icon: '💎' };
  }
  if (score >= 82 && valueM <= 8 && minutes > 500) {
    return { type: 'bargain', label: 'Bargain', icon: '🤑' };
  }
  if (moneyballIndex > 0.8 && score >= 75 && minutes > 600) {
    return { type: 'gem', label: 'Moneyball Star', icon: '⭐' };
  }
  if (score < 55 && valueM > 30) {
    return { type: 'avoid', label: 'Avoid', icon: '🚫' };
  }
  if (score >= 80 && valueM > 50) {
    return { type: 'overpriced', label: 'Overpriced', icon: '⚠️' };
  }
  return { type: 'none', label: '', icon: '' };
}

function scoreColor(s: number) {
  if (s >= 85) return '#10b981';
  if (s >= 75) return '#8b5cf6';
  if (s >= 65) return '#f59e0b';
  if (s >= 55) return '#ef4444';
  return '#dc2626';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: '#a1a1aa' }}>{label}</span>
        <span style={{ fontFamily: 'monospace', color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function P90StatsGrid({ player }: { player: Player }) {
  const stats = player.p90Stats;
  const position = player.position;

  const getRecommendedStats = () => {
    if (position === 'GK') {
      return [
        { label: 'Save %', value: stats.savePct, suffix: '%', benchmark: 75, color: '#10b981' },
        { label: 'Clean Sheets/90', value: stats.cleanSheetsP90, suffix: '', benchmark: 0.5, color: '#8b5cf6' },
      ];
    }
    if (['Central Defender', 'CDM', 'Wing Back'].includes(position)) {
      return [
        { label: 'Tackles/90', value: stats.tacklesP90, suffix: '', benchmark: 2.5, color: '#f59e0b' },
        { label: 'Interceptions/90', value: stats.interceptionsP90, suffix: '', benchmark: 2.0, color: '#f59e0b' },
        { label: 'Key Passes/90', value: stats.keyPassesP90, suffix: '', benchmark: 1.5, color: '#10b981' },
        { label: 'Pass %', value: stats.passCompletion, suffix: '%', benchmark: 85, color: '#10b981' },
      ];
    }
    if (position === 'Attacking Mid') {
      return [
        { label: 'Goals/90', value: stats.goalsP90, suffix: '', benchmark: 0.35, color: '#ef4444' },
        { label: 'Assists/90', value: stats.assistsP90, suffix: '', benchmark: 0.25, color: '#8b5cf6' },
        { label: 'xG/90', value: stats.xGP90, suffix: '', benchmark: 0.4, color: '#f59e0b' },
        { label: 'Key Passes/90', value: stats.keyPassesP90, suffix: '', benchmark: 2.5, color: '#10b981' },
      ];
    }
    return [
      { label: 'Goals/90', value: stats.goalsP90, suffix: '', benchmark: position === 'Striker' ? 0.4 : 0.35, color: '#ef4444' },
      { label: 'Assists/90', value: stats.assistsP90, suffix: '', benchmark: 0.2, color: '#8b5cf6' },
      { label: 'xG/90', value: stats.xGP90, suffix: '', benchmark: position === 'Striker' ? 0.45 : 0.4, color: '#f59e0b' },
      { label: 'Shots/90', value: stats.shotP90, suffix: '', benchmark: 2.5, color: '#10b981' },
    ];
  };

  const stats_list = getRecommendedStats();

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Minutes played</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#c4b5fd' }}>
            {Math.round(stats.minutesPlayed).toLocaleString()}
            <span style={{ fontSize: 12, color: '#71717a', marginLeft: 4, fontWeight: 400 }}>
              ({(stats.minutesPlayed / 90).toFixed(1)} matches)
            </span>
          </div>
        </div>
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Moneyball Index</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: stats.moneyballIndex > 0.7 ? '#10b981' : '#f59e0b' }}>
            {stats.moneyballIndex.toFixed(2)}
            <span style={{ fontSize: 12, color: '#71717a', marginLeft: 4, fontWeight: 400 }}>
              {stats.moneyballIndex > 0.8 ? ' 🔥 Elite' : stats.moneyballIndex > 0.6 ? ' ✓ Good' : ' ⚠️ Fair'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BarChart3 size={14} style={{ color: '#8b5cf6' }} />
        P/90 Performance Metrics
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {stats_list.map(({ label, value, suffix, benchmark }) => {
          const numValue = parseFloat(String(value));
          const percentBench = Math.min(100, (numValue / benchmark) * 100);
          const barColor = percentBench >= 100 ? '#10b981' : percentBench >= 80 ? '#8b5cf6' : percentBench >= 60 ? '#f59e0b' : '#ef4444';

          return (
            <div key={label} style={{ background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.1)', borderRadius: 8, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: barColor }}>
                  {numValue.toFixed(2)}{suffix}
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(percentBench, 100)}%`, background: barColor, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 9, color: '#52525b', marginTop: 4 }}>
                {percentBench >= 100 ? '✓ Above benchmark' : `${Math.round(percentBench)}% of benchmark`}
              </div>
            </div>
          );
        })}
      </div>

      {(stats.costPerGoal > 0 || stats.costPerAssist > 0) && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={14} style={{ color: '#10b981' }} />
            Cost Efficiency
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {stats.costPerGoal > 0 && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '12px' }}>
                <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cost per goal</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>
                  £{(stats.costPerGoal / 1000000).toFixed(1)}M
                </div>
              </div>
            )}
            {stats.costPerAssist > 0 && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '12px' }}>
                <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cost per assist</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>
                  £{(stats.costPerAssist / 1000000).toFixed(1)}M
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#a1a1aa' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#e4e4e7', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14 }}>{body}</div>
    </div>
  );
}

function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors: Record<string, [string, string]> = {
    default: ['rgba(124,58,237,0.12)', '#a78bfa'],
    success: ['#d1fae5', '#065f46'],
    warning: ['#fef3c7', '#78350f'],
    danger: ['#fee2e2', '#7f1d1d'],
    info: ['#ede9fe', '#4c1d95'],
  };
  const [bg, fg] = colors[variant];
  return (
    <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, letterSpacing: '0.03em' }}>
      {children}
    </span>
  );
}

function PlayerCard({ player, onRemove, compact = false }: { player: Player; onRemove?: () => void; compact?: boolean }) {
  return (
    <div style={{
      background: 'rgba(24,18,43,0.6)',
      border: '0.5px solid rgba(139,92,246,0.2)',
      borderRadius: 12,
      padding: compact ? '12px 16px' : '16px 20px',
      position: 'relative',
    }}>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#52525b', padding: 4,
        }}><X size={14} /></button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: compact ? 14 : 15 }}>{player.name}</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>
            {player.position} · {player.age}y · {player.league}
          </div>
        </div>
        <span style={{
          fontFamily: 'monospace', fontWeight: 700, fontSize: 18,
          color: scoreColor(player.valueScore),
        }}>{player.valueScore}</span>
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {player.badge.icon && <Tag variant="info">{player.badge.icon} {player.badge.label}</Tag>}
          <Tag>{player.transferValue}</Tag>
          <Tag>{player.wage}</Tag>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FMValueScoutV6() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [squad, setSquad] = useState<(Player | null)[]>(Array(11).fill(null));
  const [posFilter, setPosFilter] = useState('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [balanced, setBalanced] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [formation, setFormation] = useState('4-3-3');
  const [compareA, setCompareA] = useState<Player | null>(null);
  const [compareB, setCompareB] = useState<Player | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const fileRef = useRef<HTMLInputElement>(null);

  const buildPlayer = useCallback((row: Record<string, unknown>, index: number, idBase: number): Player => {
    const rawPos = String(row.Position ?? row.Pos ?? '');
    const group = getPositionGroup(rawPos);
    const league = String(row.League ?? row.Division ?? '');
    const transferValue = Math.max(0.1, parseNum(row, ['Transfer Value'], 0.5));
    const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league, balanced);
    const age = Math.max(16, Math.min(40, parseInt(String(row.Age ?? 25)) || 25));
    const minutes = Math.max(1, parseNum(row, ['Minutes', 'Mins', 'Min'], 90));
    const p90Stats = calculateP90Stats(row, group, transferValue);

    return {
      id: idBase + index,
      rank: index + 1,
      name: String(row.Name ?? row.Player ?? 'Unknown'),
      nationality: String(row.Nationality ?? row.Nat ?? '🌍'),
      age,
      position: group,
      league,
      valueScore: score,
      keyStat: group === 'GK'
        ? `Sv%: ${row['Sv %'] ?? '-'}`
        : ['CDM', 'Wing Back', 'Central Defender'].includes(group)
          ? `Tck: ${row['Tck C'] ?? '-'}`
          : `Key: ${row['Key'] ?? row['Key Passes'] ?? '-'}`,
      transferValue: String(row['Transfer Value'] ?? '£0'),
      wage: String(row.Wage ?? '£0'),
      rawData: row,
      badge: calculateBadge(score, transferValue, age, minutes, p90Stats.moneyballIndex),
      perfPercent,
      valuePercent,
      agePercent,
      p90Stats,
    };
  }, [balanced]);

  const parseAndProcessCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setUploadMsg(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const base = Date.now();
          const rows = results.data as ParsedCSVRow[];
          const validRows = rows.filter(row => row && Object.keys(row).length > 0 && row.Name);
          
          if (validRows.length === 0) {
            setUploadMsg({ type: 'error', text: 'No valid player data found. Check CSV format.' });
            setIsProcessing(false);
            return;
          }

          const parsed = validRows
            .map((row, i) => buildPlayer(row, i, base))
            .sort((a, b) => b.valueScore - a.valueScore)
            .map((p, i) => ({ ...p, rank: i + 1 }));
          
          setPlayers(parsed);
          setUploadMsg({ type: 'success', text: `✓ Loaded ${parsed.length} players | Scoring: V6 P/90 Moneyball` });
          setActiveTab('upload');
        } catch (e) {
          setUploadMsg({ type: 'error', text: `Parse error: ${e instanceof Error ? e.message : 'Unknown error'}` });
        }
        setIsProcessing(false);
      },
      error: (err) => {
        setUploadMsg({ type: 'error', text: `CSV Error: ${err.message || 'Failed to parse'}` });
        setIsProcessing(false);
      },
    });
  }, [buildPlayer]);

  const handleFile = useCallback((file: File) => {
    if (file.name.toLowerCase().endsWith('.csv')) parseAndProcessCSV(file);
    else setUploadMsg({ type: 'error', text: 'Only .csv files supported' });
  }, [parseAndProcessCSV]);

  const filtered = useMemo(() =>
    posFilter === 'All' ? players : players.filter(p => p.position === posFilter),
    [players, posFilter]);

  const addToShortlist = useCallback((p: Player) => {
    if (!shortlist.find(s => s.id === p.id)) setShortlist(prev => [...prev, p]);
  }, [shortlist]);
  const removeFromShortlist = useCallback((id: number) => setShortlist(prev => prev.filter(p => p.id !== id)), []);

  const copyName = (p: Player) => {
    navigator.clipboard.writeText(p.name);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportCSV = () => {
    if (!shortlist.length) return;
    const headers = ['Player', 'Age', 'Position', 'League', 'Score', 'Moneyball', 'Value', 'Wage'];
    const rows = shortlist.map(p => [
      p.name, p.age, p.position, p.league, p.valueScore,
      p.p90Stats.moneyballIndex.toFixed(2), p.transferValue, p.wage
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'valuescout-v6-shortlist.csv';
    a.click();
  };

  const exportPDF = () => {
    if (!shortlist.length) return;
    const doc = new jsPDF();
    doc.text('FM Value Scout V6 — Shortlist', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Player', 'Pos', 'Age', 'League', 'Score', 'Moneyball', 'Value']],
      body: shortlist.map(p => [p.name, p.position, p.age, p.league, p.valueScore, p.p90Stats.moneyballIndex.toFixed(2), p.transferValue]),
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
    });
    doc.save('ValueScout_V6_Shortlist.pdf');
  };

  const slots = FORMATION_SLOTS[formation];
  const squadStats = useMemo(() => {
    const filled = squad.filter(Boolean) as Player[];
    if (!filled.length) return { avgScore: 0, avgAge: 0, gems: 0, moneyball: 0 };
    return {
      avgScore: Math.round(filled.reduce((s, p) => s + p.valueScore, 0) / filled.length),
      avgAge: parseFloat((filled.reduce((s, p) => s + p.age, 0) / filled.length).toFixed(1)),
      gems: filled.filter(p => p.badge.type === 'gem' || p.badge.type === 'bargain').length,
      moneyball: parseFloat((filled.reduce((s, p) => s + p.p90Stats.moneyballIndex, 0) / filled.length).toFixed(2)),
    };
  }, [squad]);

  const columns = useMemo<ColumnDef<Player>[]>(() => [
    { accessorKey: 'rank', header: '#', size: 40 },
    {
      accessorKey: 'name', header: 'Player',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.original.name}</div>
          {row.original.badge.icon && (
            <span style={{ fontSize: 10, color: '#71717a' }}>
              {row.original.badge.icon} {row.original.badge.label}
            </span>
          )}
        </div>
      ),
      size: 160,
    },
    { accessorKey: 'position', header: 'Pos', size: 100 },
    { accessorKey: 'age', header: 'Age', size: 50 },
    { accessorKey: 'league', header: 'League', size: 120 },
    {
      accessorKey: 'valueScore', header: 'Score',
      cell: ({ row }) => (
        <span style={{
          fontFamily: 'monospace', fontWeight: 700, fontSize: 16,
          color: scoreColor(row.original.valueScore),
        }}>{row.original.valueScore}</span>
      ),
      size: 70,
    },
    {
      accessorKey: 'p90Stats.moneyballIndex', header: 'Moneyball 🎯',
      cell: ({ row }) => (
        <span style={{
          fontFamily: 'monospace', fontWeight: 600, fontSize: 14,
          color: row.original.p90Stats.moneyballIndex > 0.7 ? '#10b981' : row.original.p90Stats.moneyballIndex > 0.6 ? '#f59e0b' : '#ef4444'
        }}>
          {row.original.p90Stats.moneyballIndex.toFixed(2)}
        </span>
      ),
      size: 100,
    },
    {
      id: 'actions', header: '', enableSorting: false, size: 120,
      cell: ({ row }) => {
        const p = row.original;
        const inShortlist = !!shortlist.find(s => s.id === p.id);
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSelectedPlayer(p)} style={{
              background: 'rgba(139,92,246,0.1)', border: '0.5px solid rgba(139,92,246,0.3)',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              fontSize: 12, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4,
            }}><Eye size={12} /> Hub</button>
            <button onClick={() => inShortlist ? removeFromShortlist(p.id) : addToShortlist(p)} style={{
              background: inShortlist ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${inShortlist ? '#8b5cf6' : 'rgba(139,92,246,0.2)'}`,
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              fontSize: 12, color: inShortlist ? '#8b5cf6' : '#a1a1aa',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Star size={12} fill={inShortlist ? 'currentColor' : 'none'} />
              {inShortlist ? 'Saved' : 'Save'}
            </button>
          </div>
        );
      },
    },
  ], [shortlist, addToShortlist, removeFromShortlist]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A1F', color: '#e4e4e7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Nav */}
      <nav style={{
        borderBottom: '0.5px solid rgba(139,92,246,0.25)',
        background: 'rgba(15,10,31,0.95)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, letterSpacing: '-1px',
            }}>VS</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>FM Value Scout</div>
              <div style={{ fontSize: 11, color: '#a78bfa', marginTop: -2 }}>V6 · P/90 Moneyball</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: '#a1a1aa', cursor: 'pointer', padding: '6px 12px',
            }}>
              <input type="checkbox" checked={balanced} onChange={e => setBalanced(e.target.checked)}
                style={{ accentColor: '#7c3aed' }} />
              Balanced
            </label>
            <button onClick={exportCSV} disabled={!shortlist.length} style={{
              background: '#7c3aed', border: 'none', borderRadius: 8,
              color: 'white', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: shortlist.length ? 'pointer' : 'not-allowed',
              opacity: shortlist.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6,
            }}><Download size={14} /> CSV</button>
            <button onClick={exportPDF} disabled={!shortlist.length} style={{
              background: '#059669', border: 'none', borderRadius: 8,
              color: 'white', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: shortlist.length ? 'pointer' : 'not-allowed',
              opacity: shortlist.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6,
            }}><FileText size={14} /> PDF</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'flex', gap: 24 }}>

        {/* Sidebar */}
        <aside style={{ width: 240, flexShrink: 0 }}>
          <div style={{
            background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)',
            borderRadius: 16, padding: 16, position: 'sticky', top: 88,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={12} /> Position Filter
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {POSITION_FILTERS.map(f => (
                <button key={f.value} onClick={() => { setPosFilter(f.value); }}
                  title={f.description}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 12px', borderRadius: 8,
                    fontSize: 13, cursor: 'pointer', border: 'none',
                    background: posFilter === f.value ? '#7c3aed' : 'transparent',
                    color: posFilter === f.value ? 'white' : '#a1a1aa',
                    fontWeight: posFilter === f.value ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>{f.label}</button>
              ))}
            </div>

            {players.length > 0 && (
              <>
                <div style={{ height: 0.5, background: 'rgba(139,92,246,0.25)', margin: '16px 0' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Summary
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  {[
                    { label: 'Total', value: players.length },
                    { label: 'Filtered', value: filtered.length },
                    { label: 'Shortlist', value: shortlist.length },
                    { label: 'Top tier (85+)', value: filtered.filter(p => p.valueScore >= 85).length },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: '#a1a1aa' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: '#c4b5fd' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(139,92,246,0.25)', marginBottom: 24, gap: 0, overflowX: 'auto' }}>
            {[
              { id: 'upload' as Tab, label: 'Upload CSV', icon: <Upload size={14} /> },
              { id: 'data-hub' as Tab, label: 'Data Hub', icon: <Zap size={14} /> },
              { id: 'squad' as Tab, label: 'Squad Builder', icon: <Users size={14} /> },
              { id: 'compare' as Tab, label: 'Compare', icon: <BarChart3 size={14} /> },
              { id: 'guide' as Tab, label: 'Guide', icon: <HelpCircle size={14} /> },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
                color: activeTab === t.id ? '#8b5cf6' : '#71717a',
                borderBottom: activeTab === t.id ? '2px solid #7c3aed' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                transition: 'all 0.15s', marginBottom: -0.5,
              }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* UPLOAD TAB */}
          {activeTab === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                style={{
                  border: `2px dashed ${isDragging ? '#7c3aed' : 'rgba(139,92,246,0.4)'}`,
                  borderRadius: 16, padding: '48px 24px', textAlign: 'center',
                  background: isDragging ? 'rgba(124,58,237,0.06)' : 'rgba(24,18,43,0.5)',
                  transition: 'all 0.2s', cursor: 'pointer', marginBottom: 24,
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={40} style={{ color: '#7c3aed', margin: '0 auto 16px', opacity: 0.8 }} />
                <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8, color: '#e4e4e7' }}>
                  Drop your FM CSV here
                </div>
                <div style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 16 }}>
                  or click to browse · BepInEx Player Export mod required
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {isProcessing && (
                  <div style={{ color: '#8b5cf6', fontSize: 14, fontWeight: 500 }}>
                    ⏳ Processing your data...
                  </div>
                )}
                {uploadMsg && (
                  <div style={{
                    fontSize: 13, marginTop: 16, padding: '12px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: uploadMsg.type === 'success' ? '#d1fae5' : uploadMsg.type === 'warning' ? '#fef3c7' : '#fee2e2',
                    color: uploadMsg.type === 'success' ? '#065f46' : uploadMsg.type === 'warning' ? '#78350f' : '#7f1d1d',
                  }}>
                    {uploadMsg.type === 'success' && <CheckCircle size={16} />}
                    {uploadMsg.type === 'error' && <AlertCircle size={16} />}
                    {uploadMsg.text}
                  </div>
                )}
              </div>

              {players.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: '#a1a1aa' }}>
                      Showing <strong style={{ color: '#e4e4e7' }}>{filtered.length}</strong> {posFilter === 'All' ? 'players' : posFilter + 's'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['table', 'cards'] as const).map(m => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                          background: viewMode === m ? 'rgba(124,58,237,0.15)' : 'transparent',
                          border: '0.5px solid ' + (viewMode === m ? '#7c3aed' : 'rgba(139,92,246,0.25)'),
                          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                          color: viewMode === m ? '#8b5cf6' : '#71717a', fontSize: 13, fontWeight: viewMode === m ? 600 : 400,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {m === 'table' ? <List size={14} /> : <LayoutGrid size={14} />}
                          {m === 'table' ? 'Table' : 'Cards'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {viewMode === 'table' ? (
                    <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 16, overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            {table.getHeaderGroups().map(hg => (
                              <tr key={hg.id} style={{ borderBottom: '0.5px solid rgba(139,92,246,0.2)', background: 'rgba(15,10,31,0.6)' }}>
                                {hg.headers.map(h => (
                                  <th key={h.id}
                                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                                    style={{
                                      padding: '12px 16px', textAlign: 'left', fontSize: 12,
                                      fontWeight: 600, color: '#8b5cf6', cursor: h.column.getCanSort() ? 'pointer' : 'default',
                                      userSelect: 'none', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      {flexRender(h.column.columnDef.header, h.getContext())}
                                      {h.column.getIsSorted() === 'asc' ? <ChevronUp size={12} /> : h.column.getIsSorted() === 'desc' ? <ChevronDown size={12} /> : null}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            ))}
                          </thead>
                          <tbody>
                            {table.getRowModel().rows.map(row => (
                              <tr key={row.id} style={{ borderBottom: '0.5px solid rgba(139,92,246,0.1)', transition: 'background 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                {row.getVisibleCells().map(cell => (
                                  <td key={cell.id} style={{ padding: '12px 16px', fontSize: 13, verticalAlign: 'middle' }}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                      {filtered.map(p => (
                        <div key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPlayer(p)}>
                          <PlayerCard player={p} onRemove={shortlist.find(s => s.id === p.id) ? () => removeFromShortlist(p.id) : undefined} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* DATA HUB TAB */}
          {activeTab === 'data-hub' && (
            <div>
              {players.length === 0 ? (
                <EmptyState icon={<Zap />} title="No data yet" body="Upload a CSV to access the Data Hub and view detailed P/90 statistics." />
              ) : (
                <>
                  <div style={{ background: 'rgba(124,58,237,0.08)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={14} style={{ color: '#8b5cf6' }} /> How to use the Data Hub
                    </div>
                    <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
                      Click the <strong>&quot;Hub&quot;</strong> button next to any player in the table to view comprehensive performance data, P/90 breakdowns, and moneyball metrics.
                    </div>
                  </div>

                  {selectedPlayer && (
                    <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selectedPlayer.name}</h2>
                          <p style={{ fontSize: 13, color: '#a1a1aa' }}>
                            {selectedPlayer.position} · {selectedPlayer.league} · Age {selectedPlayer.age}
                          </p>
                          {selectedPlayer.badge.icon && (
                            <div style={{ marginTop: 8 }}>
                              <Tag variant="info">{selectedPlayer.badge.icon} {selectedPlayer.badge.label}</Tag>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'monospace', color: scoreColor(selectedPlayer.valueScore), lineHeight: 1 }}>
                            {selectedPlayer.valueScore}
                          </div>
                          <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, fontWeight: 600 }}>Value Score</div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Score Breakdown</div>
                        <StatBar label="Performance (P/90 stats)" value={selectedPlayer.perfPercent} color="#10b981" />
                        <StatBar label="Value for money" value={selectedPlayer.valuePercent} color="#8b5cf6" />
                        <StatBar label="Age factor" value={selectedPlayer.agePercent} color="#a78bfa" />
                      </div>

                      <P90StatsGrid player={selectedPlayer} />

                      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                        <button onClick={() => addToShortlist(selectedPlayer)} style={{
                          flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: '#7c3aed', color: 'white', fontSize: 14, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}><Star size={14} /> Add to shortlist</button>
                        <button onClick={() => copyName(selectedPlayer)} style={{
                          padding: '12px 16px', borderRadius: 8, border: '0.5px solid rgba(139,92,246,0.3)',
                          background: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}><Copy size={14} />{copiedId === selectedPlayer.id ? 'Copied!' : 'Copy name'}</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SQUAD BUILDER TAB */}
          {activeTab === 'squad' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>Formation:</span>
                {Object.keys(FORMATION_SLOTS).map(f => (
                  <button key={f} onClick={() => { setFormation(f); setSquad(Array(FORMATION_SLOTS[f].length).fill(null)); }} style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: formation === f ? '#7c3aed' : 'rgba(24,18,43,0.8)',
                    color: formation === f ? 'white' : '#a1a1aa',
                    border: formation === f ? 'none' : '0.5px solid rgba(139,92,246,0.25)',
                  }}>{f}</button>
                ))}
                <button onClick={() => setSquad(Array(slots.length).fill(null))} style={{
                  marginLeft: 'auto', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: 'none', border: '0.5px solid rgba(239,68,68,0.4)', color: '#f87171',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}><Trash2 size={13} /> Clear</button>
              </div>

              {squad.some(Boolean) && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Avg score', value: squadStats.avgScore, color: scoreColor(squadStats.avgScore) },
                    { label: 'Avg age', value: squadStats.avgAge, color: '#a1a1aa' },
                    { label: 'Moneyball', value: squadStats.moneyball, color: squadStats.moneyball > 0.6 ? '#10b981' : '#f59e0b' },
                    { label: 'Top tier', value: `${squadStats.gems} 💎`, color: '#a78bfa' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      flex: 1, background: 'rgba(24,18,43,0.7)', border: '0.5px solid rgba(139,92,246,0.2)',
                      borderRadius: 10, padding: '12px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{
                  flex: 1, background: 'rgba(5,46,22,0.2)', border: '0.5px solid rgba(34,197,94,0.15)',
                  borderRadius: 16, padding: 20, minHeight: 500,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {slots.map((slot, i) => {
                      const assigned = squad[i];
                      return (
                        <div key={i}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            const id = parseInt(e.dataTransfer.getData('playerId'));
                            const p = shortlist.find(s => s.id === id && s.position === slot.position);
                            if (p) { const s = [...squad]; s[i] = p; setSquad(s); }
                          }}
                          style={{
                            background: assigned ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                            border: '0.5px solid ' + (assigned ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'),
                            borderRadius: 10, padding: '10px', textAlign: 'center', minHeight: 80,
                            cursor: 'default', transition: 'all 0.15s',
                          }}>
                          <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{slot.label}</div>
                          {assigned ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, marginBottom: 3, color: '#e4e4e7' }}>
                                {assigned.name.split(' ').slice(-1)[0]}
                              </div>
                              <div style={{ fontSize: 12, color: scoreColor(assigned.valueScore), fontWeight: 700, marginBottom: 4 }}>{assigned.valueScore}</div>
                              <button onClick={() => { const s = [...squad]; s[i] = null; setSquad(s); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0, fontSize: 10 }}>
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: '#52525b', opacity: 0.6 }}>Drop {slot.position}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Shortlist ({shortlist.length})
                  </div>
                  {shortlist.length === 0 && (
                    <EmptyState icon={<Star />} title="Empty" body="Add from main tab." />
                  )}
                  {shortlist.map(p => (
                    <div key={p.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('playerId', p.id.toString())}
                      style={{
                        background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)',
                        borderRadius: 10, padding: '10px', marginBottom: 8, cursor: 'grab',
                        userSelect: 'none',
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{p.name.split(' ').slice(-1)[0]}</div>
                      <div style={{ fontSize: 10, color: '#71717a', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{p.position}</span>
                        <span style={{ color: scoreColor(p.valueScore), fontWeight: 700 }}>{p.valueScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COMPARE TAB */}
          {activeTab === 'compare' && (
            <div>
              {players.length === 0 ? (
                <EmptyState icon={<BarChart3 />} title="No data" body="Upload a CSV first." />
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    {([compareA, compareB] as const).map((sel, idx) => (
                      <div key={idx}>
                        <div style={{ fontSize: 12, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                          Player {idx + 1}
                        </div>
                        <select
                          value={sel?.id ?? ''}
                          onChange={e => {
                            const p = players.find(pl => pl.id === parseInt(e.target.value)) ?? null;
                            if (idx === 0) {
                              setCompareA(p);
                            } else {
                              setCompareB(p);
                            }
                          }}
                          style={{ width: '100%', padding: '10px 12px', background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#e4e4e7', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                          <option value="">Select player…</option>
                          {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {compareA && compareB && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                        {[compareA, compareB].map(p => <PlayerCard key={p.id} player={p} />)}
                      </div>

                      <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Detailed Comparison</div>
                        {[
                          { label: 'Value Score', a: compareA.valueScore, b: compareB.valueScore, max: 100 },
                          { label: 'Performance %', a: compareA.perfPercent, b: compareB.perfPercent, max: 100 },
                          { label: 'Value for Money %', a: compareA.valuePercent, b: compareB.valuePercent, max: 100 },
                          { label: 'Moneyball Index', a: compareA.p90Stats.moneyballIndex, b: compareB.p90Stats.moneyballIndex, max: 1.5 },
                        ].map(({ label, a, b, max }) => {
                          const aVal = parseFloat(String(a));
                          const bVal = parseFloat(String(b));
                          return (
                            <div key={label} style={{ marginBottom: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                                <span style={{ color: scoreColor(aVal), fontWeight: 700 }}>{aVal > 10 ? Math.round(aVal) : aVal.toFixed(2)}</span>
                                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{label}</span>
                                <span style={{ color: scoreColor(bVal), fontWeight: 700 }}>{bVal > 10 ? Math.round(bVal) : bVal.toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', direction: 'rtl' }}>
                                  <div style={{ height: '100%', width: `${Math.min((aVal / max) * 100, 100)}%`, background: scoreColor(aVal), borderRadius: 99 }} />
                                </div>
                                <div style={{ width: 2, height: 6, background: 'rgba(139,92,246,0.4)' }} />
                                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min((bVal / max) * 100, 100)}%`, background: scoreColor(bVal), borderRadius: 99 }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* GUIDE TAB */}
          {activeTab === 'guide' && (
            <div style={{ maxWidth: 720 }}>
              {[
                { icon: <Upload size={18} />, title: 'Step 1: Export CSV', body: 'Install BepInEx Player Export mod in FM26. Export position-specific player lists with recommended columns.' },
                { icon: <BarChart3 size={18} />, title: 'Step 2: Upload Data', body: 'Drag CSV into the Upload tab. V6 automatically calculates P/90 weighted scores (46-100 scale).' },
                { icon: <Zap size={18} />, title: 'Step 3: Data Hub', body: 'Click "Hub" on any player to view detailed P/90 stats, benchmarks, and moneyball metrics.' },
                { icon: <Target size={18} />, title: 'Understanding Moneyball', body: 'Score > 0.8 = elite value. 0.6-0.8 = good value. < 0.6 = investigate further. Combines performance vs cost.' },
                { icon: <Users size={18} />, title: 'Squad Builder', body: 'Drag players from shortlist into your formation. View squad-wide stats including average moneyball index.' },
                { icon: <BarChart3 size={18} />, title: 'Compare Players', body: 'Side-by-side breakdown of any two players. Visual bars show performance vs benchmarks.' },
              ].map(({ icon, title, body }, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 16, marginBottom: 18,
                  background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.15)',
                  borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: '#8b5cf6',
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Right sidebar */}
        {shortlist.length > 0 && (
          <aside style={{ width: 280, flexShrink: 0 }}>
            <div style={{
              background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)',
              borderRadius: 16, padding: 16, position: 'sticky', top: 88, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Shortlist ({shortlist.length})
                </div>
                <button onClick={() => setShortlist([])} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#52525b',
                  fontSize: 10, display: 'flex', alignItems: 'center', gap: 2,
                }}><Trash2 size={10} /> Clear</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {shortlist.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '10px 0', borderBottom: '0.5px solid rgba(139,92,246,0.1)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                        {p.position} · Age {p.age}
                      </div>
                      <div style={{ fontSize: 10, color: '#52525b', marginTop: 2, display: 'flex', gap: 4 }}>
                        <span style={{ color: scoreColor(p.valueScore), fontWeight: 700 }}>Score {p.valueScore}</span>
                        <span>·</span>
                        <span style={{ color: p.p90Stats.moneyballIndex > 0.7 ? '#10b981' : '#f59e0b' }}>🎯 {p.p90Stats.moneyballIndex.toFixed(2)}</span>
                      </div>
                    </div>
                    <button onClick={() => removeFromShortlist(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '0.5px solid rgba(139,92,246,0.2)', padding: '20px 24px', textAlign: 'center', fontSize: 12, color: '#52525b', marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 10, fontSize: 13 }}>
          <a href="https://twitter.com/JakeSummersFM" target="_blank" rel="noreferrer" style={{ color: '#71717a', textDecoration: 'none' }}>
            𝕏 @JakeSummersFM
          </a>
          <a href="https://www.twitch.tv/jakesummersfm" target="_blank" rel="noreferrer" style={{ color: '#71717a', textDecoration: 'none' }}>
            Twitch
          </a>
          <a href="https://ko-fi.com/jakesummersfm" target="_blank" rel="noreferrer" style={{ color: '#71717a', textDecoration: 'none' }}>
            Ko-fi ☕
          </a>
        </div>
        <div style={{ fontSize: 11 }}>
          FM Value Scout V6 · P/90 Moneyball · Scoring Fixed · Made for FM26
        </div>
      </footer>
    </div>
  );
}
