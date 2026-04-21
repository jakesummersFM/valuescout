'use client';

import React, {
  useState, useCallback, useMemo, useRef, useEffect
} from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, X, BarChart3, Heart, FileText, Tv, AtSign,
  Users, HelpCircle, Trash2, Copy, ChevronUp, ChevronDown, Star,
  Shield, Eye, CheckCircle, ArrowRight, Grid, List, Search, Sliders,
  Zap, TrendingUp, TrendingDown, GitCompare, Bot, Send, RotateCcw,
  PlusCircle, Filter, Target, Keyboard
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  SortingState, flexRender, ColumnDef
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  transferValueM: number;
  wage: string;
  wageK: number;
  rawData: Record<string, unknown>;
  badge: { type: 'gem' | 'overpriced' | 'overrated' | 'avoid' | 'none'; label: string; icon: string };
  perfPercent: number;
  valuePercent: number;
  agePercent: number;
  percentileInLeague?: number;
}

interface Weights { performance: number; value: number; age: number; }
interface SavedShortlist { id: string; name: string; players: Player[]; createdAt: number; }
type Tab = 'upload' | 'compare' | 'squad' | 'season' | 'howto' | 'filters';

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITION_FILTERS = [
  { label: 'All', value: 'All' }, { label: 'GK', value: 'GK' },
  { label: 'Wing-Back', value: 'Wing Back' }, { label: 'CB', value: 'Central Defender' },
  { label: 'CDM', value: 'CDM' }, { label: 'CM', value: 'Centre Mid' },
  { label: 'AM', value: 'Attacking Mid' }, { label: 'Winger', value: 'Winger' },
  { label: 'ST', value: 'Striker' },
];

const RECOMMENDED_COLUMNS: Record<string, string[]> = {
  'Central Defender': ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Tck C','Itc'],
  'CDM':              ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Tck C','Itc','Key','Pas %'],
  'Wing Back':        ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Tck C','Itc','Key','Ast'],
  'Centre Mid':       ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Tck C','Key','Ast'],
  'Attacking Mid':    ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Gls','Ast','Key','Shots','xG'],
  'Winger':           ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Gls','Ast','Key','Shots','xG'],
  'Striker':          ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Gls','Ast','Shots','xG'],
  'GK':               ['Name','Position','Age','Transfer Value','Wage','League','Minutes','Sv %','Clean Sheets'],
  'All':              ['Name','Position','Age','Transfer Value','Wage','League','Minutes'],
};

const FORMATION_SLOTS: Record<string, { label: string; position: string }[]> = {
  '4-3-3': [
    { label:'GK', position:'GK' },
    { label:'RB', position:'Wing Back' }, { label:'CB', position:'Central Defender' },
    { label:'CB', position:'Central Defender' }, { label:'LB', position:'Wing Back' },
    { label:'CM', position:'Centre Mid' }, { label:'CDM', position:'CDM' }, { label:'CM', position:'Centre Mid' },
    { label:'RW', position:'Winger' }, { label:'ST', position:'Striker' }, { label:'LW', position:'Winger' },
  ],
  '4-4-2': [
    { label:'GK', position:'GK' },
    { label:'RB', position:'Wing Back' }, { label:'CB', position:'Central Defender' },
    { label:'CB', position:'Central Defender' }, { label:'LB', position:'Wing Back' },
    { label:'RM', position:'Winger' }, { label:'CM', position:'Centre Mid' },
    { label:'CM', position:'Centre Mid' }, { label:'LM', position:'Winger' },
    { label:'ST', position:'Striker' }, { label:'ST', position:'Striker' },
  ],
  '3-5-2': [
    { label:'GK', position:'GK' },
    { label:'CB', position:'Central Defender' }, { label:'CB', position:'Central Defender' }, { label:'CB', position:'Central Defender' },
    { label:'RWB', position:'Wing Back' }, { label:'CM', position:'Centre Mid' }, { label:'CDM', position:'CDM' },
    { label:'CM', position:'Centre Mid' }, { label:'LWB', position:'Wing Back' },
    { label:'ST', position:'Striker' }, { label:'ST', position:'Striker' },
  ],
};

const DEFAULT_WEIGHTS: Weights = { performance: 55, value: 33, age: 12 };

const ANALYTICS_POSITIONS = ['All','GK','Central Defender','CDM','Wing Back','Centre Mid','Attacking Mid','Winger','Striker'];
const POS_COLORS: Record<string, string> = {
  'GK':'#f59e0b','Central Defender':'#3b82f6','CDM':'#06b6d4',
  'Wing Back':'#8b5cf6','Centre Mid':'#a78bfa','Attacking Mid':'#f97316',
  'Winger':'#10b981','Striker':'#ef4444',
};
const POS_SHORT: Record<string, string> = {
  'GK':'GK','Central Defender':'CB','CDM':'CDM','Wing Back':'WB',
  'Centre Mid':'CM','Attacking Mid':'AM','Winger':'W','Striker':'ST',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getPositionGroup(pos: string): string {
  const p = (pos || '').toLowerCase();
  if (p.includes('gk')) return 'GK';
  if (p.includes('wing back') || /\bwb\b/.test(p)) return 'Wing Back';
  if (p.includes('d (c)') || p.includes('cb') || p.includes('central def')) return 'Central Defender';
  if (p.includes('dm')) return 'CDM';
  if (p.includes('am')) return 'Attacking Mid';
  if (p.includes('cm') || p.includes('m (c)')) return 'Centre Mid';
  if (p.includes('winger') || /\brw\b/.test(p) || /\blw\b/.test(p) || p.includes('m/am (r') || p.includes('m/am (l')) return 'Winger';
  if (p.includes('st') || p.includes('cf') || /\bfw\b/.test(p)) return 'Striker';
  return 'Central Defender';
}

function getLeagueMultiplier(league: string): number {
  const l = (league || '').toLowerCase();
  if (['premier','bundesliga','la liga','serie a','ligue 1'].some(s => l.includes(s))) return 1.25;
  if (['championship','segunda','serie b'].some(s => l.includes(s))) return 1.12;
  return 1.0;
}

function parseNum(row: Record<string, unknown>, keys: string[], def = 0): number {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/ /g,'')];
    if (val !== undefined) {
      const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (!isNaN(n)) return n;
    }
  }
  return def;
}

function calculateValueScore(row: Record<string, unknown>, position: string, league: string, balanced: boolean, weights: Weights) {
  const minutes = parseNum(row, ['Minutes','Mins','Min'], 90) || 90;
  const per90 = (s: number) => minutes > 0 ? s / (minutes / 90) : s;
  const goals = per90(parseNum(row, ['Goals','Gls']));
  const assists = per90(parseNum(row, ['Assists','Ast']));
  const xG = per90(parseNum(row, ['xG']));
  const kp = per90(parseNum(row, ['Key Passes','KP','Key']));
  const shots = per90(parseNum(row, ['Shots','Sh']));
  const tck = per90(parseNum(row, ['Tackles','Tck C','Tck']));
  const itc = per90(parseNum(row, ['Interceptions','Itc']));
  const svPct = parseNum(row, ['Sv %','Save %']);
  const cs = parseNum(row, ['Clean Sheets','CS']);

  let performance = 0;
  if (position === 'GK') {
    performance = Math.min(42, svPct * 1.85 + (cs / (minutes / 90)) * 8);
  } else if (['Central Defender','CDM','Wing Back'].includes(position)) {
    performance = tck * 4.2 + itc * 4.0 + kp * 1.5 + minutes / 100;
  } else {
    performance = goals * 3.8 + assists * 2.4 + (xG > 0 ? (goals / xG) * 50 : goals * 40) + shots * 0.9 + kp * 1.8;
  }

  const leagueMult = getLeagueMultiplier(league);
  const baseScore = performance * 2.45;
  const valueM = Math.max(0.3, parseNum(row, ['Transfer Value'], 0.5));
  const wageKpw = Math.max(0.5, parseNum(row, ['Wage'], 1000) / 1000);
  const efficiency = Math.min(45, Math.max(25, 88 / (valueM * 0.45 + wageKpw * 0.55)));
  const age = parseInt(String(row.Age ?? 25)) || 25;
  const ageBonus = age <= 21 ? 16 : age <= 23 ? 11 : age <= 26 ? 7 : age >= 33 ? -12 : 0;
  const minFact = minutes < 800 ? 0.65 : minutes < 1200 ? 0.78 : 1.0;
  const wP = weights.performance / 100, wV = weights.value / 100, wA = weights.age / 100;
  let final = (baseScore * wP * 1.65 + efficiency * wV * 1.5 + ageBonus * wA * 5) * minFact * leagueMult;
  if (balanced) final *= 0.92;
  const score = Math.max(48, Math.min(97, Math.round(final)));
  const denom = Math.max(final, 1);
  return {
    score,
    perfPercent:  Math.min(100, Math.round((baseScore * wP * 1.65 / denom) * 100)) || 65,
    valuePercent: Math.min(100, Math.round((efficiency * wV * 1.5 / denom) * 100)) || 60,
    agePercent:   Math.min(100, Math.round((Math.abs(ageBonus) * wA * 5 / denom) * 100)) || 45,
  };
}

function calculateBadge(score: number, valueM: number, age: number): Player['badge'] {
  if (score >= 88 && (age <= 23 || valueM <= 12)) return { type:'gem', label:'Hidden Gem', icon:'💎' };
  if (score < 60 && valueM > 25) return { type:'avoid', label:"Don't Touch", icon:'🚫' };
  if (score >= 82 && valueM > 40) return { type:'overpriced', label:'Overpriced', icon:'⚠️' };
  if (score < 72 && valueM < 10) return { type:'overrated', label:'Overrated', icon:'🔥' };
  return { type:'none', label:'', icon:'' };
}

function scoreColor(s: number) {
  if (s >= 85) return '#10b981'; if (s >= 75) return '#8b5cf6';
  if (s >= 65) return '#f59e0b'; return '#ef4444';
}
function scoreBg(s: number) {
  if (s >= 85) return 'rgba(16,185,129,0.12)'; if (s >= 75) return 'rgba(139,92,246,0.12)';
  if (s >= 65) return 'rgba(245,158,11,0.12)'; return 'rgba(239,68,68,0.12)';
}
function posColor(pos: string) { return POS_COLORS[pos] ?? '#71717a'; }

function buildPlayer(row: Record<string, unknown>, index: number, idBase: number, balanced: boolean, weights: Weights): Player {
  const rawPos = String(row.Position ?? row.Pos ?? '');
  const group = getPositionGroup(rawPos);
  const league = String(row.League ?? row.Division ?? '');
  const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league, balanced, weights);
  const valueM = Math.max(0.3, parseNum(row, ['Transfer Value'], 0.5));
  const wageKpw = Math.max(0, parseNum(row, ['Wage'], 0));
  const age = parseInt(String(row.Age ?? 25)) || 25;
  return {
    id: idBase + index, rank: index + 1,
    name: String(row.Name ?? row.Player ?? 'Unknown'),
    nationality: String(row.Nationality ?? row.Nat ?? '🌍'),
    age, position: group, league, valueScore: score,
    keyStat: group === 'GK' ? `Sv%: ${row['Sv %'] ?? '-'}` :
      ['CDM','Wing Back','Central Defender'].includes(group) ? `Tck: ${row['Tck C'] ?? '-'} | Itc: ${row['Itc'] ?? '-'}` :
      `Key: ${row['Key'] ?? row['Key Passes'] ?? '-'}`,
    transferValue: String(row['Transfer Value'] ?? '£0'),
    transferValueM: valueM,
    wage: String(row.Wage ?? '£0'),
    wageK: wageKpw,
    rawData: row,
    badge: calculateBadge(score, valueM, age),
    perfPercent, valuePercent, agePercent,
  };
}

function addLeaguePercentiles(players: Player[]): Player[] {
  const byLeague: Record<string, number[]> = {};
  players.forEach(p => { if (!byLeague[p.league]) byLeague[p.league] = []; byLeague[p.league].push(p.valueScore); });
  return players.map(p => {
    const scores = byLeague[p.league].sort((a, b) => a - b);
    return { ...p, percentileInLeague: Math.round((scores.indexOf(p.valueScore) / Math.max(scores.length - 1, 1)) * 100) };
  });
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12 }}>
        <span style={{ color:'#71717a' }}>{label}</span>
        <span style={{ fontFamily:'monospace', color, fontWeight:500 }}>{value}%</span>
      </div>
      <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:99, transition:'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ textAlign:'center', padding:'3rem 1rem', color:'#71717a' }}>
      <div style={{ fontSize:32, marginBottom:10, opacity:0.3 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:500, color:'#a1a1aa', marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:13 }}>{body}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span style={{ background:scoreBg(score), color:scoreColor(score), fontFamily:'monospace', fontWeight:700, fontSize:15, padding:'2px 10px', borderRadius:99, border:`0.5px solid ${scoreColor(score)}40` }}>
      {score}
    </span>
  );
}

function PlayerCard({ player, onRemove, onClick }: { player: Player; onRemove?: () => void; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background:'rgba(24,18,43,0.9)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:12, padding:'14px 16px', position:'relative', cursor:onClick?'pointer':'default', transition:'border-color 0.15s' }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.5)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.2)')}>
      {onRemove && <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ position:'absolute', top:8, right:8, background:'none', border:'none', cursor:'pointer', color:'#52525b', padding:2 }}><X size={12} /></button>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
          <div style={{ fontWeight:500, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{player.name}</div>
          <div style={{ fontSize:11, color:'#71717a', marginTop:2 }}>{player.position} · {player.age}y · {player.league}</div>
        </div>
        <ScorePill score={player.valueScore} />
      </div>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
        {player.badge.icon && <span style={{ fontSize:11, background:'rgba(124,58,237,0.12)', color:'#a78bfa', padding:'2px 8px', borderRadius:99, border:'0.5px solid rgba(139,92,246,0.2)' }}>{player.badge.icon} {player.badge.label}</span>}
        <span style={{ fontSize:11, background:'rgba(255,255,255,0.05)', color:'#71717a', padding:'2px 8px', borderRadius:99 }}>{player.transferValue}</span>
        <span style={{ fontSize:11, background:'rgba(255,255,255,0.05)', color:'#71717a', padding:'2px 8px', borderRadius:99 }}>{player.wage}</span>
      </div>
    </div>
  );
}

// ─── Analytics: Tooltip ───────────────────────────────────────────────────────

function AnalyticsTooltip({ player, x, y, chartW, chartH }: { player: Player; x: number; y: number; chartW: number; chartH: number }) {
  const W = 220, H = 130;
  const left = x + W + 16 > chartW ? x - W - 8 : x + 16;
  const top  = y + H + 8 > chartH  ? y - H      : y;
  return (
    <div style={{ position:'absolute', left, top, width:W, pointerEvents:'none', zIndex:20, background:'rgba(8,5,18,0.97)', border:`1px solid ${posColor(player.position)}40`, borderRadius:10, padding:'12px 14px', boxShadow:`0 0 24px ${posColor(player.position)}30` }}>
      <div style={{ fontWeight:700, fontSize:13, marginBottom:2, color:'#f4f4f5' }}>{player.name}</div>
      <div style={{ fontSize:11, color:posColor(player.position), marginBottom:8 }}>{POS_SHORT[player.position] ?? player.position} · {player.league}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px', fontSize:11 }}>
        {[['Score',player.valueScore],['Age',player.age],['Value',player.transferValue],['Wage',player.wage]].map(([k,v]) => (
          <div key={String(k)}><span style={{ color:'#52525b' }}>{k} </span><span style={{ color:'#e4e4e7', fontWeight:600 }}>{v}</span></div>
        ))}
      </div>
      {player.badge.icon && <div style={{ marginTop:8, fontSize:11, color:'#a78bfa' }}>{player.badge.icon} {player.badge.label}</div>}
    </div>
  );
}

// ─── Analytics: Wage vs Value Scatter ────────────────────────────────────────

function WageValueScatter({ players, posFilter, shortlistIds, onHover, onSelect, hoveredId, onAddToShortlist }: {
  players: Player[]; posFilter: string; shortlistIds: Set<number>;
  onHover: (p: Player | null, x: number, y: number) => void;
  onSelect: (p: Player) => void; hoveredId: number | null;
  onAddToShortlist: (p: Player) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 680, H = 480, PAD = { t:32, r:24, b:56, l:64 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const [lassoRect, setLassoRect] = useState<{ x1:number;y1:number;x2:number;y2:number }|null>(null);
  const dragging = useRef(false);

  const visible = useMemo(() => players.filter(p => (posFilter==='All'||p.position===posFilter) && p.wageK>0 && p.transferValueM>0), [players,posFilter]);
  const maxWage  = useMemo(() => Math.max(...visible.map(p => p.wageK), 1), [visible]);
  const maxValue = useMemo(() => Math.max(...visible.map(p => p.transferValueM), 1), [visible]);
  const toSvg    = (p: Player) => ({ cx: PAD.l + (p.wageK/maxWage)*innerW, cy: PAD.t + innerH - (p.transferValueM/maxValue)*innerH });
  const wageTicks  = [0,.25,.5,.75,1].map(t => ({ v:t*maxWage,  x:PAD.l+t*innerW }));
  const valueTicks = [0,.25,.5,.75,1].map(t => ({ v:t*maxValue, y:PAD.t+innerH-t*innerH }));
  const svgPoint = (e: React.MouseEvent) => { const r = svgRef.current!.getBoundingClientRect(); return { x:(e.clientX-r.left)*(W/r.width), y:(e.clientY-r.top)*(H/r.height) }; };
  const inRect   = (cx:number,cy:number) => { if(!lassoRect) return false; const {x1,y1,x2,y2}=lassoRect; return cx>=Math.min(x1,x2)&&cx<=Math.max(x1,x2)&&cy>=Math.min(y1,y2)&&cy<=Math.max(y1,y2); };
  const lassoSelected = useMemo(() => lassoRect ? visible.filter(p => { const {cx,cy}=toSvg(p); return inRect(cx,cy); }) : [], [lassoRect,visible]);

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}
        onMouseDown={e => { if(e.button!==0) return; const pt=svgPoint(e); dragging.current=true; setLassoRect({x1:pt.x,y1:pt.y,x2:pt.x,y2:pt.y}); }}
        onMouseMove={e => { if(dragging.current&&lassoRect) { const pt=svgPoint(e); setLassoRect(r=>r?{...r,x2:pt.x,y2:pt.y}:r); } }}
        onMouseUp={() => { dragging.current=false; }}
        onMouseLeave={() => { dragging.current=false; onHover(null,0,0); }}>
        {wageTicks.map(t=><line key={t.v} x1={t.x} y1={PAD.t} x2={t.x} y2={PAD.t+innerH} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>)}
        {valueTicks.map(t=><line key={t.v} x1={PAD.l} y1={t.y} x2={PAD.l+innerW} y2={t.y} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>)}
        <polygon points={`${PAD.l},${PAD.t+innerH} ${PAD.l+innerW*0.45},${PAD.t+innerH} ${PAD.l},${PAD.t+innerH*0.55}`} fill="rgba(16,185,129,0.05)"/>
        <polygon points={`${PAD.l+innerW*0.45},${PAD.t+innerH} ${PAD.l+innerW},${PAD.t+innerH} ${PAD.l+innerW},${PAD.t+innerH*0.55} ${PAD.l+innerW*0.55},${PAD.t}`} fill="rgba(239,68,68,0.05)"/>
        <text x={PAD.l+14} y={PAD.t+innerH-14} fontSize={11} fill="rgba(16,185,129,0.5)" fontStyle="italic">← bargain zone</text>
        <text x={PAD.l+innerW-90} y={PAD.t+22} fontSize={11} fill="rgba(239,68,68,0.5)" fontStyle="italic">overpriced →</text>
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
        <line x1={PAD.l} y1={PAD.t+innerH} x2={PAD.l+innerW} y2={PAD.t+innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
        {wageTicks.map(t=><text key={t.v} x={t.x} y={PAD.t+innerH+18} textAnchor="middle" fontSize={10} fill="#52525b">£{t.v>=1000?`${(t.v/1000).toFixed(0)}m`:`${Math.round(t.v)}k`}</text>)}
        {valueTicks.filter((_,i)=>i>0).map(t=><text key={t.v} x={PAD.l-8} y={t.y+4} textAnchor="end" fontSize={10} fill="#52525b">£{t.v>=1?`${t.v.toFixed(0)}m`:`${(t.v*1000).toFixed(0)}k`}</text>)}
        <text x={PAD.l+innerW/2} y={H-6} textAnchor="middle" fontSize={11} fill="#71717a">Weekly Wage →</text>
        <text x={14} y={PAD.t+innerH/2} textAnchor="middle" fontSize={11} fill="#71717a" transform={`rotate(-90,14,${PAD.t+innerH/2})`}>Transfer Value →</text>
        {visible.map(p => {
          const {cx,cy}=toSvg(p); const col=posColor(p.position);
          const inList=shortlistIds.has(p.id), hov=hoveredId===p.id, inSel=inRect(cx,cy);
          const r=hov?9:inSel?8:6;
          return (
            <g key={p.id} onClick={e=>{e.stopPropagation();if(!dragging.current)onSelect(p);}}
              onMouseEnter={e=>{const rect=svgRef.current!.getBoundingClientRect();onHover(p,e.clientX-rect.left,e.clientY-rect.top);}}
              onMouseLeave={()=>onHover(null,0,0)} style={{cursor:'pointer'}}>
              {(hov||inList)&&<circle cx={cx} cy={cy} r={r+6} fill={col} opacity={0.12}/>}
              <circle cx={cx} cy={cy} r={r} fill={inSel?col:`${col}cc`} stroke={inList?'#fff':hov?col:'transparent'} strokeWidth={inList?2:1.5}/>
              {hov&&<text x={cx} y={cy-r-4} textAnchor="middle" fontSize={9} fill={col} fontWeight={700}>{p.valueScore}</text>}
            </g>
          );
        })}
        {lassoRect&&<rect x={Math.min(lassoRect.x1,lassoRect.x2)} y={Math.min(lassoRect.y1,lassoRect.y2)} width={Math.abs(lassoRect.x2-lassoRect.x1)} height={Math.abs(lassoRect.y2-lassoRect.y1)} fill="rgba(124,58,237,0.08)" stroke="rgba(139,92,246,0.6)" strokeWidth={1} strokeDasharray="4 2"/>}
      </svg>
      {lassoSelected.length>0&&(
        <div style={{ position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', background:'rgba(8,5,18,0.95)', border:'1px solid rgba(139,92,246,0.4)', borderRadius:99, padding:'8px 16px', display:'flex', alignItems:'center', gap:12, fontSize:13, boxShadow:'0 4px 24px rgba(0,0,0,0.6)' }}>
          <span style={{color:'#a78bfa'}}>{lassoSelected.length} players selected</span>
          <button onClick={()=>{lassoSelected.forEach(p=>onAddToShortlist(p));setLassoRect(null);}} style={{background:'#7c3aed',border:'none',borderRadius:99,padding:'4px 14px',color:'white',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}><Star size={12}/> Add all to shortlist</button>
          <button onClick={()=>setLassoRect(null)} style={{background:'none',border:'none',color:'#52525b',cursor:'pointer',padding:0}}><X size={14}/></button>
        </div>
      )}
    </div>
  );
}

// ─── Analytics: Age vs Score Bubble Chart ────────────────────────────────────

function AgeBubbleChart({ players, posFilter, shortlistIds, onHover, onSelect, hoveredId }: {
  players: Player[]; posFilter: string; shortlistIds: Set<number>;
  onHover: (p: Player|null,x:number,y:number) => void;
  onSelect: (p: Player) => void; hoveredId: number|null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W=680,H=480,PAD={t:32,r:24,b:56,l:64};
  const innerW=W-PAD.l-PAD.r, innerH=H-PAD.t-PAD.b;
  const visible = useMemo(()=>players.filter(p=>posFilter==='All'||p.position===posFilter),[players,posFilter]);
  const minAge=16,maxAge=38,minScore=48,maxScore=97;
  const maxVal = useMemo(()=>Math.max(...visible.map(p=>p.transferValueM),1),[visible]);
  const toSvg  = (p:Player)=>({ cx:PAD.l+((p.age-minAge)/(maxAge-minAge))*innerW, cy:PAD.t+innerH-((p.valueScore-minScore)/(maxScore-minScore))*innerH, r:4+(p.transferValueM/maxVal)*14 });
  const ageTicks   = [16,19,22,25,28,31,34,37].map(a=>({a,x:PAD.l+((a-minAge)/(maxAge-minAge))*innerW}));
  const scoreTicks = [50,60,70,80,90].map(s=>({s,y:PAD.t+innerH-((s-minScore)/(maxScore-minScore))*innerH}));
  const gemZoneX=PAD.l, gemZoneW=PAD.l+((24-minAge)/(maxAge-minAge))*innerW-PAD.l;
  const gemZoneY=PAD.t+innerH-((82-minScore)/(maxScore-minScore))*innerH;
  const gemZoneH=PAD.t+innerH-gemZoneY;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}} onMouseLeave={()=>onHover(null,0,0)}>
      {ageTicks.map(t=><line key={t.a} x1={t.x} y1={PAD.t} x2={t.x} y2={PAD.t+innerH} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>)}
      {scoreTicks.map(t=><line key={t.s} x1={PAD.l} y1={t.y} x2={PAD.l+innerW} y2={t.y} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>)}
      <rect x={gemZoneX} y={gemZoneY} width={gemZoneW} height={gemZoneH} fill="rgba(16,185,129,0.07)" rx={4}/>
      <text x={gemZoneX+gemZoneW/2} y={gemZoneY+16} textAnchor="middle" fontSize={10} fill="rgba(16,185,129,0.6)" fontStyle="italic">💎 gem zone</text>
      {[{s:75,label:'Good',col:'#8b5cf6'},{s:85,label:'Excellent',col:'#10b981'}].map(({s,label,col})=>{
        const y=PAD.t+innerH-((s-minScore)/(maxScore-minScore))*innerH;
        return <g key={s}><line x1={PAD.l} y1={y} x2={PAD.l+innerW} y2={y} stroke={col} strokeWidth={0.5} strokeDasharray="6 4" opacity={0.4}/><text x={PAD.l+innerW-4} y={y-4} textAnchor="end" fontSize={9} fill={col} opacity={0.7}>{label}</text></g>;
      })}
      {(()=>{ const x=PAD.l+((26-minAge)/(maxAge-minAge))*innerW; return <g><line x1={x} y1={PAD.t} x2={x} y2={PAD.t+innerH} stroke="rgba(245,158,11,0.25)" strokeWidth={0.5} strokeDasharray="6 4"/><text x={x+4} y={PAD.t+10} fontSize={9} fill="rgba(245,158,11,0.6)">peak age →</text></g>; })()}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
      <line x1={PAD.l} y1={PAD.t+innerH} x2={PAD.l+innerW} y2={PAD.t+innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
      {ageTicks.map(t=><text key={t.a} x={t.x} y={PAD.t+innerH+18} textAnchor="middle" fontSize={10} fill="#52525b">{t.a}</text>)}
      {scoreTicks.map(t=><text key={t.s} x={PAD.l-8} y={t.y+4} textAnchor="end" fontSize={10} fill="#52525b">{t.s}</text>)}
      <text x={PAD.l+innerW/2} y={H-6} textAnchor="middle" fontSize={11} fill="#71717a">Age →</text>
      <text x={14} y={PAD.t+innerH/2} textAnchor="middle" fontSize={11} fill="#71717a" transform={`rotate(-90,14,${PAD.t+innerH/2})`}>Value Score →</text>
      <g transform={`translate(${PAD.l+innerW-90},${PAD.t+innerH-80})`}>
        <text x={0} y={0} fontSize={9} fill="#52525b">Bubble = transfer value</text>
        {[4,9,14].map((r,i)=><circle key={r} cx={8+i*26} cy={20+r} r={r} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5}/>)}
        <text x={0} y={52} fontSize={8} fill="#52525b">low</text>
        <text x={50} y={52} fontSize={8} fill="#52525b">high</text>
      </g>
      {[...visible].sort((a,b)=>b.transferValueM-a.transferValueM).map(p=>{
        const {cx,cy,r}=toSvg(p); const col=posColor(p.position);
        const inList=shortlistIds.has(p.id), hov=hoveredId===p.id;
        return (
          <g key={p.id} onClick={()=>onSelect(p)}
            onMouseEnter={e=>{const rect=svgRef.current!.getBoundingClientRect();onHover(p,e.clientX-rect.left,e.clientY-rect.top);}}
            onMouseLeave={()=>onHover(null,0,0)} style={{cursor:'pointer'}}>
            {(hov||inList)&&<circle cx={cx} cy={cy} r={r+5} fill={col} opacity={0.1}/>}
            <circle cx={cx} cy={cy} r={r} fill={`${col}55`} stroke={inList?'#fff':hov?col:`${col}88`} strokeWidth={inList?2:1}/>
            {(r>9||hov)&&<text x={cx} y={cy+4} textAnchor="middle" fontSize={8} fill={hov?'#fff':col} fontWeight={600}>{POS_SHORT[p.position]??''}</text>}
            {hov&&<text x={cx} y={cy-r-5} textAnchor="middle" fontSize={9} fill={col} fontWeight={700}>{p.valueScore}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Analytics Dashboard (full-screen overlay) ────────────────────────────────

function AnalyticsDashboard({ players, shortlist, onAddToShortlist, onRemoveFromShortlist, onClose }: {
  players: Player[]; shortlist: Player[];
  onAddToShortlist:(p:Player)=>void; onRemoveFromShortlist:(id:number)=>void; onClose:()=>void;
}) {
  const [posFilter,    setPosFilter]    = useState('All');
  const [activeChart,  setActiveChart]  = useState<'scatter'|'bubble'>('scatter');
  const [hoveredPlayer,setHoveredPlayer]= useState<Player|null>(null);
  const [hoveredXY,    setHoveredXY]    = useState({x:0,y:0});
  const [selPlayer,    setSelPlayer]    = useState<Player|null>(null);
  const [showLegend,   setShowLegend]   = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);
  const shortlistIds = useMemo(()=>new Set(shortlist.map(p=>p.id)),[shortlist]);
  const gems     = useMemo(()=>players.filter(p=>p.badge.type==='gem').length,[players]);
  const avoid    = useMemo(()=>players.filter(p=>p.badge.type==='avoid').length,[players]);
  const topValue = useMemo(()=>[...players].sort((a,b)=>b.valueScore-a.valueScore).slice(0,3),[players]);
  const visCount = useMemo(()=>players.filter(p=>posFilter==='All'||p.position===posFilter).length,[players,posFilter]);
  const handleHover = useCallback((p:Player|null,x:number,y:number)=>{setHoveredPlayer(p);setHoveredXY({x,y});},[]);
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(selPlayer)setSelPlayer(null);else onClose();}}; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); },[selPlayer,onClose]);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'#06040f', display:'flex', flexDirection:'column', fontFamily:"'DM Mono','Fira Code','Consolas',monospace" }}>
      {/* Header */}
      <header style={{ display:'flex', alignItems:'center', gap:16, padding:'0 20px', height:52, flexShrink:0, borderBottom:'1px solid rgba(139,92,246,0.15)', background:'rgba(6,4,15,0.95)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white' }}>VS</div>
          <span style={{ fontSize:13, fontWeight:700, color:'#f4f4f5' }}>Value Analytics</span>
          <span style={{ fontSize:11, color:'#52525b', padding:'2px 8px', background:'rgba(255,255,255,0.04)', borderRadius:99 }}>{players.length} players</span>
        </div>
        <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:3, marginLeft:12 }}>
          {([{id:'scatter',label:'Wage vs Value'},{id:'bubble',label:'Age vs Score'}] as const).map(c=>(
            <button key={c.id} onClick={()=>setActiveChart(c.id)} style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, background:activeChart===c.id?'#7c3aed':'transparent', color:activeChart===c.id?'white':'#71717a', fontFamily:'inherit', transition:'all 0.15s' }}>{c.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:5, marginLeft:8, flexWrap:'wrap' }}>
          {ANALYTICS_POSITIONS.map(pos=>(
            <button key={pos} onClick={()=>setPosFilter(pos)} style={{ padding:'4px 10px', borderRadius:99, border:'none', cursor:'pointer', fontSize:11, background:posFilter===pos?(pos==='All'?'rgba(255,255,255,0.12)':`${posColor(pos)}33`):'transparent', color:posFilter===pos?(pos==='All'?'#f4f4f5':posColor(pos)):'#52525b', fontFamily:'inherit', boxShadow:posFilter===pos&&pos!=='All'?`0 0 8px ${posColor(pos)}40`:'none' }}>
              {pos==='All'?'All':(POS_SHORT[pos]??pos)}
            </button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#52525b' }}>{visCount} shown · Esc to close</span>
          <button onClick={()=>setShowLegend(l=>!l)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'4px 10px', color:'#71717a', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>{showLegend?'Hide':'Show'} legend</button>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#52525b', padding:4, display:'flex', alignItems:'center' }}><X size={18}/></button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Chart */}
        <div ref={chartRef} style={{ flex:1, padding:'16px 20px', position:'relative', overflow:'hidden' }}>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#f4f4f5', letterSpacing:'-0.5px' }}>{activeChart==='scatter'?'Wage vs Transfer Value':'Age vs Value Score'}</div>
            <div style={{ fontSize:12, color:'#52525b', marginTop:2 }}>{activeChart==='scatter'?'Bottom-left = best value. Drag to lasso-select a cluster.':'Larger bubbles = higher value. Green zone = young high-scorers.'}</div>
          </div>
          <div style={{ position:'relative' }}>
            {activeChart==='scatter'
              ? <WageValueScatter players={players} posFilter={posFilter} shortlistIds={shortlistIds} onHover={handleHover} onSelect={setSelPlayer} hoveredId={hoveredPlayer?.id??null} onAddToShortlist={onAddToShortlist}/>
              : <AgeBubbleChart   players={players} posFilter={posFilter} shortlistIds={shortlistIds} onHover={handleHover} onSelect={setSelPlayer} hoveredId={hoveredPlayer?.id??null}/>
            }
            {hoveredPlayer&&<AnalyticsTooltip player={hoveredPlayer} x={hoveredXY.x} y={hoveredXY.y} chartW={chartRef.current?.offsetWidth??800} chartH={chartRef.current?.offsetHeight??500}/>}
          </div>
          {activeChart==='scatter'&&<div style={{ position:'absolute', bottom:28, right:28, fontSize:11, color:'#3f3f46', display:'flex', alignItems:'center', gap:5 }}><Target size={12}/> Drag to lasso-select</div>}
        </div>

        {/* Right panel */}
        <div style={{ width:280, flexShrink:0, borderLeft:'1px solid rgba(139,92,246,0.12)', display:'flex', flexDirection:'column', background:'rgba(6,4,15,0.6)', overflow:'hidden' }}>
          {/* Stats */}
          <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(139,92,246,0.1)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#52525b', letterSpacing:'0.1em', marginBottom:12, textTransform:'uppercase' }}>Overview</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                {label:'Hidden Gems',value:gems,color:'#10b981',icon:'💎'},
                {label:"Don't Touch",value:avoid,color:'#ef4444',icon:'🚫'},
                {label:'Shortlisted',value:shortlist.length,color:'#8b5cf6',icon:'★'},
                {label:'Avg Score',value:players.length?Math.round(players.reduce((s,p)=>s+p.valueScore,0)/players.length):0,color:'#f59e0b',icon:'◎'},
              ].map(({label,value,color,icon})=>(
                <div key={label} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${color}20`, borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:18, fontWeight:700, color, fontFamily:'inherit' }}>{icon} {value}</div>
                  <div style={{ fontSize:10, color:'#52525b', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Top picks */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(139,92,246,0.1)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#52525b', letterSpacing:'0.1em', marginBottom:10, textTransform:'uppercase' }}>Top value picks</div>
            {topValue.map((p,i)=>(
              <div key={p.id} onClick={()=>setSelPlayer(p)} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:i<2?'1px solid rgba(139,92,246,0.06)':'none', cursor:'pointer' }}>
                <div style={{ fontSize:13, fontWeight:700, color:['#f59e0b','#71717a','#b45309'][i], width:16, textAlign:'center' }}>{['①','②','③'][i]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#f4f4f5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize:10, color:posColor(p.position) }}>{POS_SHORT[p.position]??p.position} · {p.transferValue}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:scoreColor(p.valueScore) }}>{p.valueScore}</div>
              </div>
            ))}
          </div>
          {/* Legend */}
          {showLegend&&(
            <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(139,92,246,0.1)', flexShrink:0 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#52525b', letterSpacing:'0.1em', marginBottom:10, textTransform:'uppercase' }}>Position colours</div>
              {Object.entries(POS_COLORS).map(([pos,col])=>{ const count=players.filter(p=>p.position===pos).length; if(!count) return null; return (
                <div key={pos} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <div style={{ width:8, height:8, borderRadius:99, background:col, flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:'#71717a', flex:1 }}>{pos}</span>
                  <span style={{ fontSize:11, color:'#52525b' }}>{count}</span>
                </div>
              );})}
            </div>
          )}
          {/* Shortlist */}
          <div style={{ flex:1, overflow:'auto', padding:'12px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#52525b', letterSpacing:'0.1em', marginBottom:10, textTransform:'uppercase' }}>Shortlist ({shortlist.length})</div>
            {shortlist.length===0&&<div style={{ fontSize:12, color:'#3f3f46', lineHeight:1.6 }}>Click any dot to view a player.</div>}
            {shortlist.map(p=>(
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(139,92,246,0.06)' }}>
                <div style={{ width:6, height:6, borderRadius:99, background:posColor(p.position), flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#f4f4f5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize:10, color:'#52525b' }}>{POS_SHORT[p.position]??p.position} · {p.age}y</div>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:scoreColor(p.valueScore) }}>{p.valueScore}</div>
                <button onClick={()=>onRemoveFromShortlist(p.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#3f3f46', padding:2 }}><X size={11}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Player modal inside analytics */}
      {selPlayer&&(
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }} onClick={e=>e.target===e.currentTarget&&setSelPlayer(null)}>
          <div style={{ background:'#0c0818', border:`1px solid ${posColor(selPlayer.position)}40`, borderRadius:16, width:420, padding:'24px', boxShadow:`0 0 60px ${posColor(selPlayer.position)}20` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:'#f4f4f5', marginBottom:3 }}>{selPlayer.name}</div>
                <div style={{ fontSize:12, color:posColor(selPlayer.position) }}>{selPlayer.position} · {selPlayer.league} · Age {selPlayer.age}</div>
                {selPlayer.badge.icon&&<div style={{ marginTop:8, fontSize:12, color:'#a78bfa' }}>{selPlayer.badge.icon} {selPlayer.badge.label}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:42, fontWeight:700, color:scoreColor(selPlayer.valueScore), lineHeight:1, fontFamily:'inherit' }}>{selPlayer.valueScore}</div>
                <div style={{ fontSize:10, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em' }}>score</div>
              </div>
            </div>
            {[{label:'Performance',value:selPlayer.perfPercent,color:'#10b981'},{label:'Value/money',value:selPlayer.valuePercent,color:'#8b5cf6'},{label:'Age factor',value:selPlayer.agePercent,color:'#f59e0b'}].map(({label,value,color})=>(
              <div key={label} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}><span style={{color:'#52525b'}}>{label}</span><span style={{color,fontWeight:600}}>{value}%</span></div>
                <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:99 }}><div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:99 }}/></div>
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, margin:'16px 0' }}>
              {[{label:'Transfer value',value:selPlayer.transferValue},{label:'Weekly wage',value:selPlayer.wage}].map(({label,value})=>(
                <div key={label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:'#52525b', marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#f4f4f5' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {shortlistIds.has(selPlayer.id)
                ? <button onClick={()=>{onRemoveFromShortlist(selPlayer.id);setSelPlayer(null);}} style={{ flex:1, padding:'9px 0', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>Remove from shortlist</button>
                : <button onClick={()=>onAddToShortlist(selPlayer)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:'none', background:'#7c3aed', color:'white', cursor:'pointer', fontSize:13, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><Star size={13}/> Add to shortlist</button>
              }
              <button onClick={()=>setSelPlayer(null)} style={{ padding:'9px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'none', color:'#71717a', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function FMValueScoutV5() {
  const [players,        setPlayers]        = useState<Player[]>([]);
  const [seasonBPlayers, setSeasonBPlayers] = useState<Player[]>([]);
  const [shortlist,      setShortlist]      = useState<Player[]>([]);
  const [squad,          setSquad]          = useState<(Player|null)[]>(Array(11).fill(null));
  const [posFilter,      setPosFilter]      = useState('All');
  const [sorting,        setSorting]        = useState<SortingState>([{id:'valueScore',desc:true}]);
  const [isDragging,     setIsDragging]     = useState(false);
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [uploadMsg,      setUploadMsg]      = useState<{type:'success'|'error'|'warning';text:string}|null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player|null>(null);
  const [activeTab,      setActiveTab]      = useState<Tab>('upload');
  const [balanced,       setBalanced]       = useState(false);
  const [copiedId,       setCopiedId]       = useState<number|null>(null);
  const [formation,      setFormation]      = useState('4-3-3');
  const [compareA,       setCompareA]       = useState<Player|null>(null);
  const [compareB,       setCompareB]       = useState<Player|null>(null);
  const [viewMode,       setViewMode]       = useState<'table'|'cards'>('table');
  const [weights,        setWeights]        = useState<Weights>(DEFAULT_WEIGHTS);
  const [showWeights,    setShowWeights]    = useState(false);
  const [showAnalytics,  setShowAnalytics]  = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [minAge,         setMinAge]         = useState(15);
  const [maxAge,         setMaxAge]         = useState(40);
  const [maxValue,       setMaxValue]       = useState(200);
  const [leagueFilter,   setLeagueFilter]   = useState('All');
  const [showFilters,    setShowFilters]    = useState(false);
  const [savedShortlists,setSavedShortlists]= useState<SavedShortlist[]>(()=>{ try{return JSON.parse(localStorage.getItem('fm_shortlists')||'[]');}catch{return [];} });

  const fileRef  = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);
  const searchRef= useRef<HTMLInputElement>(null);

  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement) return; if(e.key==='/'||e.key==='s'){e.preventDefault();searchRef.current?.focus();} if(e.key==='Escape') setSelectedPlayer(null); if(e.key==='1') setActiveTab('upload'); if(e.key==='2') setActiveTab('compare'); if(e.key==='3') setActiveTab('squad'); }; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); },[]);
  useEffect(()=>{ try{localStorage.setItem('fm_shortlists',JSON.stringify(savedShortlists));}catch{} },[savedShortlists]);

  const allLeagues = useMemo(()=>['All',...Array.from(new Set(players.map(p=>p.league).filter(Boolean))).sort()],[players]);

  const processCSV = useCallback((file:File, isSeasonB=false)=>{
    setIsProcessing(true); setUploadMsg(null);
    Papa.parse(file,{
      header:true, skipEmptyLines:true,
      complete:(results)=>{
        const base=Date.now();
        const parsed=(results.data as Record<string,unknown>[]).map((row,i)=>buildPlayer(row,i,base,balanced,weights)).sort((a,b)=>b.valueScore-a.valueScore).map((p,i)=>({...p,rank:i+1}));
        const withP=addLeaguePercentiles(parsed);
        if(isSeasonB){setSeasonBPlayers(withP);setUploadMsg({type:'success',text:`Season B: ${withP.length} players loaded`});}
        else{setPlayers(withP);setUploadMsg({type:'success',text:`Loaded ${withP.length} players`});setActiveTab('upload');}
        setIsProcessing(false);
      },
      error:()=>{setUploadMsg({type:'error',text:'Failed to parse CSV'});setIsProcessing(false);},
    });
  },[balanced,weights]);

  useEffect(()=>{
    if(!players.length) return;
    const base=Date.now();
    const recalc=players.map((p,i)=>buildPlayer(p.rawData,i,base,balanced,weights)).sort((a,b)=>b.valueScore-a.valueScore).map((p,i)=>({...p,rank:i+1}));
    setPlayers(addLeaguePercentiles(recalc));
  },[balanced,weights]);

  const filtered = useMemo(()=>{
    let out=players;
    if(posFilter!=='All') out=out.filter(p=>p.position===posFilter);
    if(leagueFilter!=='All') out=out.filter(p=>p.league===leagueFilter);
    if(searchQuery.trim()) out=out.filter(p=>p.name.toLowerCase().includes(searchQuery.toLowerCase())||p.league.toLowerCase().includes(searchQuery.toLowerCase()));
    out=out.filter(p=>p.age>=minAge&&p.age<=maxAge&&p.transferValueM<=maxValue);
    return out;
  },[players,posFilter,leagueFilter,searchQuery,minAge,maxAge,maxValue]);

  const addToShortlist    = (p:Player)=>{ if(!shortlist.find(s=>s.id===p.id)) setShortlist(prev=>[...prev,p]); };
  const removeFromShortlist=(id:number)=>setShortlist(prev=>prev.filter(p=>p.id!==id));
  const saveShortlist     = ()=>{ const name=prompt('Name this shortlist:'); if(!name) return; setSavedShortlists(prev=>[...prev,{id:Date.now().toString(),name,players:shortlist,createdAt:Date.now()}]); };
  const copyName          = (p:Player)=>{ navigator.clipboard.writeText(p.name); setCopiedId(p.id); setTimeout(()=>setCopiedId(null),1500); };
  const autoFillSquad     = ()=>{ const slots=FORMATION_SLOTS[formation]; const used=new Set<number>(); setSquad(slots.map(slot=>{ const c=shortlist.filter(p=>!used.has(p.id)&&p.position===slot.position).sort((a,b)=>b.valueScore-a.valueScore)[0]??null; if(c) used.add(c.id); return c; })); };

  const exportCSV=()=>{ if(!shortlist.length) return; const rows=['Player,Age,Position,League,Score,Value,Wage',...shortlist.map(p=>`${p.name},${p.age},${p.position},${p.league},${p.valueScore},${p.transferValue},${p.wage}`)].join('\n'); const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows); a.download='valuescout-shortlist.csv'; a.click(); };
  const exportPDF=()=>{ if(!shortlist.length) return; const doc=new jsPDF(); doc.text('FM Value Scout V5 — Shortlist',14,20); autoTable(doc,{startY:30,head:[['Player','Position','Age','League','Score','Value','Wage']],body:shortlist.map(p=>[p.name,p.position,p.age,p.league,p.valueScore,p.transferValue,p.wage]),theme:'grid',headStyles:{fillColor:[139,92,246]}}); doc.save('ValueScout_Shortlist.pdf'); };
  const exportTransferReport=(player:Player)=>{ const doc=new jsPDF(); doc.setFontSize(20); doc.text('FM Value Scout — Transfer Report',14,22); doc.setFontSize(14); doc.text(player.name,14,34); doc.setFontSize(11); doc.setTextColor(100); doc.text(`${player.position} · ${player.league} · Age ${player.age}`,14,42); doc.setTextColor(0); doc.setFontSize(13); doc.text(`Value Score: ${player.valueScore}/97`,14,54); doc.text(`Transfer Value: ${player.transferValue}`,14,62); doc.text(`Weekly Wage: ${player.wage}`,14,70); doc.text(`Badge: ${player.badge.label||'None'}`,14,78); autoTable(doc,{startY:88,head:[['Metric','Score']],body:[['Performance',`${player.perfPercent}%`],['Value for money',`${player.valuePercent}%`],['Age factor',`${player.agePercent}%`],['League percentile',`${player.percentileInLeague??'N/A'}%`]],theme:'grid',headStyles:{fillColor:[124,58,237]}}); const recY=(doc as any).lastAutoTable.finalY+12; const verdict=player.valueScore>=85?'Strongly recommend signing.':player.valueScore>=75?'Good signing if budget allows.':player.valueScore>=65?'Potential option — negotiate price down.':'Not recommended at current price.'; doc.setTextColor(80); doc.text(`Recommendation: ${verdict}`,14,recY); doc.save(`${player.name.replace(/ /g,'_')}_Report.pdf`); };

  const seasonComparison=useMemo(()=>{ if(!players.length||!seasonBPlayers.length) return []; return players.map(a=>{const b=seasonBPlayers.find(p=>p.name.toLowerCase()===a.name.toLowerCase());if(!b)return null;return{player:a,scoreA:a.valueScore,scoreB:b.valueScore,delta:b.valueScore-a.valueScore};}).filter(Boolean).sort((a,b)=>Math.abs(b!.delta)-Math.abs(a!.delta)) as {player:Player;scoreA:number;scoreB:number;delta:number}[]; },[players,seasonBPlayers]);
  const squadStats=useMemo(()=>{ const filled=squad.filter(Boolean) as Player[]; if(!filled.length) return{avgScore:0,avgAge:0,gems:0,totalWage:0}; return{avgScore:Math.round(filled.reduce((s,p)=>s+p.valueScore,0)/filled.length),avgAge:parseFloat((filled.reduce((s,p)=>s+p.age,0)/filled.length).toFixed(1)),gems:filled.filter(p=>p.badge.type==='gem').length,totalWage:Math.round(filled.reduce((s,p)=>s+p.wageK,0))}; },[squad]);

  const btnStyle: React.CSSProperties = { background:'transparent', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:6, padding:'5px 8px', cursor:'pointer', color:'#71717a', display:'flex', alignItems:'center', gap:4, fontSize:12 };

  const columns=useMemo<ColumnDef<Player>[]>(()=>[
    {accessorKey:'rank',header:'#',size:48},
    {accessorKey:'name',header:'Player',cell:({row})=><div><div style={{fontWeight:500,fontSize:14}}>{row.original.name}</div>{row.original.badge.icon&&<span style={{fontSize:11,color:'#8b5cf6'}}>{row.original.badge.icon} {row.original.badge.label}</span>}</div>},
    {accessorKey:'position',header:'Position'},
    {accessorKey:'age',header:'Age',size:60},
    {id:'league',header:'League',accessorFn:row=>row.league,cell:({row})=><div style={{fontSize:13}}><div>{row.original.league}</div>{row.original.percentileInLeague!==undefined&&<div style={{fontSize:11,color:'#71717a'}}>Top {100-row.original.percentileInLeague}% in league</div>}</div>},
    {accessorKey:'keyStat',header:'Key Stat',enableSorting:false},
    {accessorKey:'transferValue',header:'Value'},
    {accessorKey:'valueScore',header:'Score',cell:({row})=><ScorePill score={row.original.valueScore}/>,size:80},
    {id:'actions',header:'',enableSorting:false,cell:({row})=>{ const p=row.original; const inList=!!shortlist.find(s=>s.id===p.id); return(<div style={{display:'flex',gap:5}}><button onClick={()=>setSelectedPlayer(p)} style={btnStyle}><Eye size={13}/></button><button onClick={()=>copyName(p)} style={btnStyle}><Copy size={13}/></button><button onClick={()=>inList?removeFromShortlist(p.id):addToShortlist(p)} style={{...btnStyle,background:inList?'rgba(124,58,237,0.15)':'transparent',color:inList?'#a78bfa':'#71717a'}}><Star size={13} fill={inList?'currentColor':'none'}/></button></div>); }},
  ],[shortlist,copiedId]);

  const table=useReactTable({data:filtered,columns,state:{sorting},onSortingChange:setSorting,getCoreRowModel:getCoreRowModel(),getSortedRowModel:getSortedRowModel()});

  const TAB_CONFIG: {id:Tab;label:string;icon?:React.ReactNode}[]=[
    {id:'upload',label:'Players'},
    {id:'compare',label:'Compare',icon:<GitCompare size={13}/>},
    {id:'squad',label:'Squad',icon:<Users size={13}/>},
    {id:'season',label:'Season Δ',icon:<TrendingUp size={13}/>},
    {id:'howto',label:'How To',icon:<HelpCircle size={13}/>},
    {id:'filters',label:'Columns',icon:<Filter size={13}/>},
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#0A0714', color:'#e4e4e7', fontFamily:'var(--font-sans,system-ui)' }}>

      {/* Nav */}
      <nav style={{ borderBottom:'0.5px solid rgba(139,92,246,0.2)', background:'rgba(10,7,20,0.95)', backdropFilter:'blur(16px)', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11 }}>VS</div>
            <div><div style={{ fontWeight:600, fontSize:15, letterSpacing:'-0.3px' }}>FM Value Scout</div><div style={{ fontSize:10, color:'#7c3aed', marginTop:-2 }}>V5 Enhanced</div></div>
          </div>
          <div style={{ flex:1, maxWidth:400, margin:'0 20px', position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#52525b' }}/>
            <input ref={searchRef} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search players… (press /)" style={{ width:'100%', padding:'7px 12px 7px 32px', background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(139,92,246,0.25)', borderRadius:8, color:'#e4e4e7', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#71717a', cursor:'pointer' }}>
              <input type="checkbox" checked={balanced} onChange={e=>setBalanced(e.target.checked)} style={{ accentColor:'#7c3aed' }}/> Balanced
            </label>
            <button onClick={()=>setShowWeights(!showWeights)} style={{ ...btnStyle, color:showWeights?'#a78bfa':'#71717a' }}><Sliders size={14}/></button>
            <button onClick={()=>setShowAnalytics(true)} disabled={!players.length} style={{ background:'rgba(16,185,129,0.15)', border:'0.5px solid rgba(16,185,129,0.3)', borderRadius:7, color:'#10b981', padding:'6px 12px', fontSize:12, cursor:players.length?'pointer':'not-allowed', opacity:players.length?1:0.4, display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}>
              <BarChart3 size={13}/> Analytics
            </button>
            <button onClick={exportCSV} disabled={!shortlist.length} style={{ background:'#7c3aed', border:'none', borderRadius:7, color:'white', padding:'6px 12px', fontSize:12, cursor:shortlist.length?'pointer':'not-allowed', opacity:shortlist.length?1:0.4, display:'flex', alignItems:'center', gap:5 }}><Download size={13}/> CSV ({shortlist.length})</button>
            <button onClick={exportPDF} disabled={!shortlist.length} style={{ background:'#059669', border:'none', borderRadius:7, color:'white', padding:'6px 12px', fontSize:12, cursor:shortlist.length?'pointer':'not-allowed', opacity:shortlist.length?1:0.4, display:'flex', alignItems:'center', gap:5 }}><FileText size={13}/> PDF</button>
          </div>
        </div>
        {showWeights&&(
          <div style={{ borderTop:'0.5px solid rgba(139,92,246,0.15)', background:'rgba(10,7,20,0.98)', padding:'12px 20px', display:'flex', gap:24, maxWidth:1400, margin:'0 auto', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ fontSize:12, color:'#8b5cf6', fontWeight:500 }}>Score weights</div>
            {(['performance','value','age'] as const).map(key=>(
              <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label style={{ fontSize:12, color:'#71717a', width:90, textTransform:'capitalize' }}>{key}: <strong style={{color:'#e4e4e7'}}>{weights[key]}%</strong></label>
                <input type="range" min={5} max={80} value={weights[key]} onChange={e=>{ const v=parseInt(e.target.value); const rem=100-v; const others=(['performance','value','age'] as const).filter(k=>k!==key); setWeights({...weights,[key]:v,[others[0]]:Math.round(rem*0.6),[others[1]]:Math.round(rem*0.4)}); }} style={{ width:100, accentColor:'#7c3aed' }}/>
              </div>
            ))}
            <button onClick={()=>setWeights(DEFAULT_WEIGHTS)} style={{ ...btnStyle, fontSize:11 }}><RotateCcw size={11}/> Reset</button>
          </div>
        )}
      </nav>

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'16px 20px', display:'flex', gap:18 }}>
        {/* Sidebar */}
        <aside style={{ width:180, flexShrink:0 }}>
          <div style={{ background:'rgba(20,14,38,0.9)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:14, padding:14, position:'sticky', top:72 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#7c3aed', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.1em' }}>Position</div>
            {POSITION_FILTERS.map(f=>(
              <button key={f.value} onClick={()=>setPosFilter(f.value)} style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 10px', marginBottom:3, borderRadius:7, fontSize:12, cursor:'pointer', border:'none', background:posFilter===f.value?'rgba(124,58,237,0.25)':'transparent', color:posFilter===f.value?'#c4b5fd':'#71717a', fontWeight:posFilter===f.value?500:400 }}>{f.label}</button>
            ))}
            {players.length>0&&(
              <>
                <div style={{ height:0.5, background:'rgba(139,92,246,0.15)', margin:'12px 0' }}/>
                <div style={{ fontSize:10, fontWeight:600, color:'#7c3aed', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.1em' }}>Stats</div>
                {[{label:'Loaded',value:players.length},{label:'Showing',value:filtered.length},{label:'Listed',value:shortlist.length},{label:'Gems',value:`${players.filter(p=>p.badge.type==='gem').length} 💎`}].map(({label,value})=>(
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}><span style={{color:'#52525b'}}>{label}</span><span style={{fontWeight:500}}>{value}</span></div>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex:1, minWidth:0 }}>
          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'0.5px solid rgba(139,92,246,0.2)', marginBottom:20, overflowX:'auto' }}>
            {TAB_CONFIG.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'9px 16px', border:'none', background:'none', cursor:'pointer', fontSize:12, fontWeight:activeTab===t.id?600:400, color:activeTab===t.id?'#a78bfa':'#52525b', borderBottom:`2px solid ${activeTab===t.id?'#7c3aed':'transparent'}`, display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap', transition:'all 0.15s', marginBottom:-0.5 }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Players ── */}
          {activeTab==='upload'&&(
            <div>
              <div onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)} onDrop={e=>{e.preventDefault();setIsDragging(false);if(e.dataTransfer.files[0])processCSV(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current?.click()} style={{ border:`1.5px dashed ${isDragging?'#7c3aed':'rgba(139,92,246,0.3)'}`, borderRadius:14, padding:'28px 20px', textAlign:'center', background:isDragging?'rgba(124,58,237,0.05)':'rgba(20,14,38,0.5)', transition:'all 0.2s', cursor:'pointer', marginBottom:16 }}>
                <Upload size={28} style={{ color:'#7c3aed', margin:'0 auto 8px' }}/>
                <div style={{ fontWeight:500, fontSize:14, marginBottom:4 }}>Drop FM CSV or click to upload</div>
                <div style={{ fontSize:12, color:'#52525b' }}>Requires BepInEx Player Export mod for FM26</div>
                <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&processCSV(e.target.files[0])}/>
                {isProcessing&&<div style={{color:'#8b5cf6',fontSize:12,marginTop:8}}>Processing…</div>}
                {uploadMsg&&<div style={{ fontSize:12, marginTop:10, padding:'6px 14px', borderRadius:7, display:'inline-block', background:uploadMsg.type==='success'?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)', color:uploadMsg.type==='success'?'#10b981':'#f87171', border:`0.5px solid ${uploadMsg.type==='success'?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}` }}>{uploadMsg.text}</div>}
              </div>
              {players.length>0&&(
                <>
                  <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                    <button onClick={()=>setShowFilters(!showFilters)} style={{...btnStyle,color:showFilters?'#a78bfa':'#71717a'}}><Filter size={13}/> Filters {showFilters?'▲':'▼'}</button>
                    <select value={leagueFilter} onChange={e=>setLeagueFilter(e.target.value)} style={{ background:'rgba(20,14,38,0.8)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:7, color:'#a1a1aa', fontSize:12, padding:'5px 10px', cursor:'pointer' }}>
                      {allLeagues.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                    <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                      {(['table','cards'] as const).map(m=><button key={m} onClick={()=>setViewMode(m)} style={{...btnStyle,color:viewMode===m?'#a78bfa':'#52525b',background:viewMode===m?'rgba(124,58,237,0.1)':'transparent'}}>{m==='table'?<List size={13}/>:<Grid size={13}/>}</button>)}
                    </div>
                  </div>
                  {showFilters&&(
                    <div style={{ background:'rgba(20,14,38,0.8)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:12, padding:'16px 20px', marginBottom:16, display:'flex', gap:24, flexWrap:'wrap', alignItems:'center' }}>
                      <div><div style={{fontSize:11,color:'#71717a',marginBottom:4}}>Age: {minAge}–{maxAge}</div><div style={{display:'flex',gap:8}}><input type="range" min={15} max={40} value={minAge} onChange={e=>setMinAge(+e.target.value)} style={{width:80,accentColor:'#7c3aed'}}/><input type="range" min={15} max={40} value={maxAge} onChange={e=>setMaxAge(+e.target.value)} style={{width:80,accentColor:'#7c3aed'}}/></div></div>
                      <div><div style={{fontSize:11,color:'#71717a',marginBottom:4}}>Max value: £{maxValue}m</div><input type="range" min={0} max={200} value={maxValue} onChange={e=>setMaxValue(+e.target.value)} style={{width:120,accentColor:'#7c3aed'}}/></div>
                      <button onClick={()=>{setMinAge(15);setMaxAge(40);setMaxValue(200);setLeagueFilter('All');setSearchQuery('');}} style={{...btnStyle,fontSize:11}}><RotateCcw size={11}/> Clear</button>
                    </div>
                  )}
                  <div style={{ fontSize:12, color:'#52525b', marginBottom:10 }}>Showing <strong style={{color:'#a1a1aa'}}>{filtered.length}</strong> of {players.length} players</div>
                  {viewMode==='table'?(
                    <div style={{ background:'rgba(20,14,38,0.9)', border:'0.5px solid rgba(139,92,246,0.2)', borderRadius:14, overflow:'hidden' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>{table.getHeaderGroups().map(hg=><tr key={hg.id} style={{borderBottom:'0.5px solid rgba(139,92,246,0.15)',background:'rgba(10,7,20,0.6)'}}>{hg.headers.map(h=><th key={h.id} onClick={h.column.getCanSort()?h.column.getToggleSortingHandler():undefined} style={{padding:'10px 14px',textAlign:'left',fontSize:10,fontWeight:600,color:'#7c3aed',cursor:h.column.getCanSort()?'pointer':'default',userSelect:'none',letterSpacing:'0.07em',textTransform:'uppercase'}}><div style={{display:'flex',alignItems:'center',gap:3}}>{flexRender(h.column.columnDef.header,h.getContext())}{h.column.getIsSorted()==='asc'&&<ChevronUp size={11}/>}{h.column.getIsSorted()==='desc'&&<ChevronDown size={11}/>}</div></th>)}</tr>)}</thead>
                        <tbody>{table.getRowModel().rows.map(row=><tr key={row.id} style={{borderBottom:'0.5px solid rgba(139,92,246,0.08)',transition:'background 0.1s',cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(124,58,237,0.05)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')} onDoubleClick={()=>setSelectedPlayer(row.original)}>{row.getVisibleCells().map(cell=><td key={cell.id} style={{padding:'10px 14px',fontSize:13,verticalAlign:'middle'}}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  ):(
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
                      {filtered.map(p=><PlayerCard key={p.id} player={p} onClick={()=>setSelectedPlayer(p)}/>)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Compare ── */}
          {activeTab==='compare'&&(
            <div>
              {!players.length?<EmptyState icon={<BarChart3/>} title="No players loaded" body="Upload a CSV first."/>:(
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                    {([compareA,compareB] as const).map((sel,idx)=>(
                      <div key={idx}>
                        <div style={{fontSize:11,color:'#8b5cf6',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>Player {idx+1}</div>
                        <select value={sel?.id??''} onChange={e=>{const p=players.find(pl=>pl.id===parseInt(e.target.value))??null;idx===0?setCompareA(p):setCompareB(p);}} style={{width:'100%',padding:'8px 12px',background:'rgba(20,14,38,0.9)',border:'0.5px solid rgba(139,92,246,0.3)',borderRadius:8,color:'#e4e4e7',fontSize:13}}>
                          <option value="">Select a player…</option>
                          {players.map(p=><option key={p.id} value={p.id}>{p.name} ({p.position}, {p.age}y)</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  {compareA&&compareB?(
                    <div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>{[compareA,compareB].map(p=><PlayerCard key={p.id} player={p}/>)}</div>
                      <div style={{background:'rgba(20,14,38,0.9)',border:'0.5px solid rgba(139,92,246,0.2)',borderRadius:14,padding:'20px 24px'}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:16}}>Breakdown comparison</div>
                        {[{label:'Value Score',a:compareA.valueScore,b:compareB.valueScore,max:97},{label:'Performance',a:compareA.perfPercent,b:compareB.perfPercent,max:100},{label:'Value for money',a:compareA.valuePercent,b:compareB.valuePercent,max:100},{label:'Age factor',a:compareA.agePercent,b:compareB.agePercent,max:100},{label:'League percentile',a:compareA.percentileInLeague??0,b:compareB.percentileInLeague??0,max:100}].map(({label,a,b,max})=>(
                          <div key={label} style={{marginBottom:14}}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#52525b',marginBottom:5}}><span style={{color:scoreColor(a),fontWeight:600}}>{a}</span><span>{label}</span><span style={{color:scoreColor(b),fontWeight:600}}>{b}</span></div>
                            <div style={{display:'flex',gap:4,alignItems:'center'}}>
                              <div style={{flex:1,height:5,background:'rgba(255,255,255,0.06)',borderRadius:99,overflow:'hidden',direction:'rtl'}}><div style={{height:'100%',width:`${(a/max)*100}%`,background:scoreColor(a),borderRadius:99}}/></div>
                              <div style={{width:4,height:4,borderRadius:99,background:'rgba(255,255,255,0.15)',flexShrink:0}}/>
                              <div style={{flex:1,height:5,background:'rgba(255,255,255,0.06)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',width:`${(b/max)*100}%`,background:scoreColor(b),borderRadius:99}}/></div>
                            </div>
                          </div>
                        ))}
                        <div style={{marginTop:14,padding:'10px 14px',borderRadius:8,background:'rgba(124,58,237,0.08)',fontSize:12,color:'#c4b5fd',lineHeight:1.6}}>
                          {compareA.valueScore>compareB.valueScore?`💡 ${compareA.name} scores ${compareA.valueScore-compareB.valueScore} pts higher.`:compareA.valueScore<compareB.valueScore?`💡 ${compareB.name} scores ${compareB.valueScore-compareA.valueScore} pts higher.`:'💡 Both players score identically — check the breakdown.'}
                        </div>
                      </div>
                    </div>
                  ):<EmptyState icon={<GitCompare/>} title="Select two players" body="Use the dropdowns above."/>}
                </>
              )}
            </div>
          )}

          {/* ── Squad ── */}
          {activeTab==='squad'&&(
            <div>
              <div style={{display:'flex',gap:8,marginBottom:20,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{fontSize:12,color:'#71717a'}}>Formation:</div>
                {Object.keys(FORMATION_SLOTS).map(f=><button key={f} onClick={()=>{setFormation(f);setSquad(Array(FORMATION_SLOTS[f].length).fill(null));}} style={{padding:'5px 14px',borderRadius:7,fontSize:12,cursor:'pointer',background:formation===f?'#7c3aed':'transparent',color:formation===f?'white':'#71717a',border:`0.5px solid ${formation===f?'#7c3aed':'rgba(139,92,246,0.2)'}`}}>{f}</button>)}
                <button onClick={autoFillSquad} disabled={!shortlist.length} style={{padding:'5px 14px',borderRadius:7,fontSize:12,cursor:shortlist.length?'pointer':'not-allowed',background:'rgba(16,185,129,0.15)',color:'#10b981',border:'0.5px solid rgba(16,185,129,0.3)',opacity:shortlist.length?1:0.4,display:'flex',alignItems:'center',gap:5}}><Zap size={12}/> Auto-fill</button>
                <button onClick={()=>setSquad(Array(FORMATION_SLOTS[formation].length).fill(null))} style={{...btnStyle,marginLeft:'auto',color:'#f87171',fontSize:11}}><Trash2 size={11}/> Clear</button>
              </div>
              {squad.some(Boolean)&&(
                <div style={{display:'flex',gap:10,marginBottom:16}}>
                  {[{label:'Avg score',value:squadStats.avgScore,color:scoreColor(squadStats.avgScore)},{label:'Avg age',value:squadStats.avgAge,color:'#a1a1aa'},{label:'Gems',value:`${squadStats.gems} 💎`,color:'#a78bfa'},{label:'Wage/wk',value:`£${squadStats.totalWage}k`,color:'#f59e0b'}].map(({label,value,color})=>(
                    <div key={label} style={{flex:1,background:'rgba(20,14,38,0.8)',border:'0.5px solid rgba(139,92,246,0.15)',borderRadius:10,padding:'10px 14px',textAlign:'center'}}>
                      <div style={{fontSize:18,fontWeight:600,color}}>{value}</div>
                      <div style={{fontSize:10,color:'#52525b',marginTop:2}}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:16}}>
                <div style={{flex:1,background:'rgba(5,46,22,0.25)',border:'0.5px solid rgba(34,197,94,0.1)',borderRadius:14,padding:16,minHeight:380}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {FORMATION_SLOTS[formation].map((slot,i)=>{ const assigned=squad[i]; return(
                      <div key={i} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=parseInt(e.dataTransfer.getData('playerId'));const p=shortlist.find(s=>s.id===id);if(p){const s=[...squad];s[i]=p;setSquad(s);}}} style={{background:assigned?'rgba(124,58,237,0.18)':'rgba(255,255,255,0.03)',border:`0.5px solid ${assigned?'rgba(139,92,246,0.4)':'rgba(255,255,255,0.06)'}`,borderRadius:9,padding:'10px 8px',textAlign:'center',minHeight:70,transition:'all 0.15s'}}>
                        <div style={{fontSize:9,color:'#52525b',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em'}}>{slot.label}</div>
                        {assigned?(<><div style={{fontSize:11,fontWeight:500,lineHeight:1.3,marginBottom:2}}>{assigned.name.split(' ').slice(-1)[0]}</div><div style={{fontSize:11,fontWeight:700,color:scoreColor(assigned.valueScore)}}>{assigned.valueScore}</div><button onClick={()=>{const s=[...squad];s[i]=null;setSquad(s);}} style={{background:'none',border:'none',cursor:'pointer',color:'#52525b',padding:0,marginTop:2}}><X size={10}/></button></>):(<div style={{fontSize:10,color:'#3f3f46'}}>Drop here</div>)}
                      </div>
                    );})}
                  </div>
                </div>
                <div style={{width:200,flexShrink:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#7c3aed',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.1em'}}>Shortlist ({shortlist.length})</div>
                  {!shortlist.length&&<EmptyState icon={<Star/>} title="Empty" body="Add players from the Players tab."/>}
                  {shortlist.map(p=><div key={p.id} draggable onDragStart={e=>e.dataTransfer.setData('playerId',p.id.toString())} style={{background:'rgba(20,14,38,0.8)',border:'0.5px solid rgba(139,92,246,0.15)',borderRadius:9,padding:'9px 11px',marginBottom:7,cursor:'grab',userSelect:'none'}}><div style={{fontWeight:500,fontSize:12}}>{p.name}</div><div style={{fontSize:10,color:'#71717a',display:'flex',justifyContent:'space-between',marginTop:2}}><span>{p.position} · {p.age}y</span><span style={{color:scoreColor(p.valueScore),fontWeight:600}}>{p.valueScore}</span></div></div>)}
                </div>
              </div>
            </div>
          )}

          {/* ── Season Δ ── */}
          {activeTab==='season'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
                <div><div style={{fontSize:11,color:'#8b5cf6',marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Season A (current)</div><div style={{fontSize:12,color:players.length?'#10b981':'#71717a'}}>{players.length?`${players.length} players loaded`:'Not loaded'}</div></div>
                <div><div style={{fontSize:11,color:'#8b5cf6',marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Season B (compare to)</div><label style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(124,58,237,0.1)',border:'0.5px solid rgba(139,92,246,0.3)',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:13,color:'#c4b5fd'}}><Upload size={13}/> Upload Season B CSV<input ref={fileRefB} type="file" accept=".csv" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&processCSV(e.target.files[0],true)}/></label>{seasonBPlayers.length>0&&<div style={{fontSize:12,color:'#10b981',marginTop:6}}>{seasonBPlayers.length} players loaded</div>}</div>
              </div>
              {seasonComparison.length>0?(
                <div style={{background:'rgba(20,14,38,0.9)',border:'0.5px solid rgba(139,92,246,0.2)',borderRadius:14,overflow:'hidden'}}>
                  <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(139,92,246,0.15)',fontSize:12,color:'#71717a'}}>{seasonComparison.length} players matched · sorted by biggest change</div>
                  {seasonComparison.slice(0,30).map(({player,scoreA,scoreB,delta})=>(
                    <div key={player.id} style={{display:'flex',alignItems:'center',gap:14,padding:'10px 16px',borderBottom:'0.5px solid rgba(139,92,246,0.06)',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(124,58,237,0.04)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <div style={{flex:1}}><div style={{fontWeight:500,fontSize:13}}>{player.name}</div><div style={{fontSize:11,color:'#52525b'}}>{player.position} · {player.league}</div></div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <ScorePill score={scoreA}/><ArrowRight size={12} style={{color:'#52525b'}}/><ScorePill score={scoreB}/>
                        <div style={{minWidth:48,textAlign:'center',fontSize:13,fontWeight:700,color:delta>0?'#10b981':delta<0?'#ef4444':'#71717a',background:delta>0?'rgba(16,185,129,0.1)':delta<0?'rgba(239,68,68,0.1)':'rgba(255,255,255,0.04)',padding:'2px 8px',borderRadius:99}}>{delta>0?`+${delta}`:delta}</div>
                        {delta>5&&<TrendingUp size={14} style={{color:'#10b981'}}/>}{delta<-5&&<TrendingDown size={14} style={{color:'#ef4444'}}/>}
                      </div>
                    </div>
                  ))}
                </div>
              ):<EmptyState icon={<GitCompare/>} title="Upload Season B to compare" body="Load a second CSV to see who improved or declined."/>}
            </div>
          )}

          {/* ── How To ── */}
          {activeTab==='howto'&&(
            <div style={{maxWidth:680}}>
              {[
                {step:'1',title:'Export from FM26',body:'Install the BepInEx Player Export mod. Open any player list in FM26, then export it as a CSV.',icon:<Upload size={16}/>},
                {step:'2',title:'Add the right columns',body:'Add the recommended stat columns before exporting. See the Columns tab for the full list per position.',icon:<List size={16}/>},
                {step:'3',title:'Upload & score',body:'Drop the CSV on the Players tab. Every player gets a Value Score (48–97) based on stats, value, wage, age, and league quality.',icon:<CheckCircle size={16}/>},
                {step:'4',title:'Open Analytics',body:'Click the green Analytics button in the nav. Two full-screen charts: Wage vs Value scatter and Age vs Score bubbles. Drag to lasso-select a cluster and shortlist them in one click.',icon:<BarChart3 size={16}/>},
                {step:'5',title:'Shortlist & export',body:'Star players to shortlist them. Build your XI in the Squad tab, compare head-to-head, and export a PDF transfer report per player.',icon:<Star size={16}/>},
                {step:'6',title:'Track across seasons',body:'Upload a second CSV in the Season Δ tab to see who improved or declined — great for development squads.',icon:<TrendingUp size={16}/>},
              ].map(({step,title,body,icon})=>(
                <div key={step} style={{display:'flex',gap:14,marginBottom:14,background:'rgba(20,14,38,0.7)',border:'0.5px solid rgba(139,92,246,0.15)',borderRadius:12,padding:'14px 18px'}}>
                  <div style={{width:34,height:34,borderRadius:9,background:'rgba(124,58,237,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'#8b5cf6'}}>{icon}</div>
                  <div><div style={{fontWeight:600,fontSize:14,marginBottom:3}}>{step}. {title}</div><div style={{fontSize:13,color:'#71717a',lineHeight:1.6}}>{body}</div></div>
                </div>
              ))}
              <div style={{background:'rgba(10,7,20,0.6)',border:'0.5px solid rgba(139,92,246,0.2)',borderRadius:10,padding:'14px 16px',marginTop:8}}>
                <div style={{fontSize:12,fontWeight:600,color:'#a78bfa',marginBottom:8,display:'flex',alignItems:'center',gap:5}}><Keyboard size={13}/> Keyboard shortcuts</div>
                {[['/ or S','Focus search'],['1–3','Switch tabs'],['Esc','Close modal']].map(([key,label])=>(
                  <div key={key} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}><code style={{background:'rgba(255,255,255,0.06)',padding:'1px 7px',borderRadius:5,fontFamily:'monospace',fontSize:11}}>{key}</code><span style={{color:'#71717a'}}>{label}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* ── Columns ── */}
          {activeTab==='filters'&&(
            <div>
              <div style={{fontSize:13,color:'#71717a',marginBottom:18,maxWidth:560,lineHeight:1.6}}>Add these columns to your FM player list before exporting. More columns = more accurate scores.</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
                {Object.entries(RECOMMENDED_COLUMNS).filter(([k])=>k!=='All').map(([pos,cols])=>(
                  <div key={pos} style={{background:'rgba(20,14,38,0.8)',border:'0.5px solid rgba(139,92,246,0.15)',borderRadius:12,padding:'14px 16px'}}>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'#c4b5fd',display:'flex',alignItems:'center',gap:6}}><Shield size={13}/>{pos}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {cols.map(col=><code key={col} style={{fontSize:11,padding:'2px 8px',borderRadius:5,background:'rgba(124,58,237,0.1)',color:'#a78bfa',fontFamily:'monospace',border:'0.5px solid rgba(139,92,246,0.15)'}}>{col}</code>)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:18,padding:'12px 16px',background:'rgba(16,185,129,0.08)',border:'0.5px solid rgba(16,185,129,0.2)',borderRadius:10,fontSize:12,color:'#6ee7b7',maxWidth:520}}>Always include: Name, Age, Position, Transfer Value, Wage, League, Minutes as a minimum.</div>
            </div>
          )}
        </main>

        {/* Shortlist sidebar */}
        {shortlist.length>0&&(
          <aside style={{width:210,flexShrink:0}}>
            <div style={{background:'rgba(20,14,38,0.9)',border:'0.5px solid rgba(139,92,246,0.2)',borderRadius:14,padding:14,position:'sticky',top:72}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:600,color:'#7c3aed',textTransform:'uppercase',letterSpacing:'0.1em'}}>Shortlist ({shortlist.length})</div>
                <div style={{display:'flex',gap:5}}>
                  <button onClick={saveShortlist} title="Save" style={{...btnStyle,fontSize:10,padding:'3px 7px'}}><PlusCircle size={11}/></button>
                  <button onClick={()=>setShortlist([])} style={{...btnStyle,color:'#f87171',fontSize:10,padding:'3px 7px'}}><Trash2 size={11}/></button>
                </div>
              </div>
              {shortlist.map(p=>(
                <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'0.5px solid rgba(139,92,246,0.08)'}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div><div style={{fontSize:10,color:'#52525b'}}>{p.position} · {p.age}y</div></div>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                    <span style={{fontFamily:'monospace',fontWeight:700,fontSize:13,color:scoreColor(p.valueScore)}}>{p.valueScore}</span>
                    <button onClick={()=>removeFromShortlist(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#3f3f46',padding:2}}><X size={11}/></button>
                  </div>
                </div>
              ))}
              {savedShortlists.length>0&&(
                <><div style={{height:0.5,background:'rgba(139,92,246,0.12)',margin:'12px 0'}}/><div style={{fontSize:10,fontWeight:600,color:'#7c3aed',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.1em'}}>Saved</div>
                {savedShortlists.map(sl=><div key={sl.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}><button onClick={()=>setShortlist(sl.players)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#8b5cf6',textAlign:'left',padding:0}}>{sl.name} <span style={{color:'#52525b'}}>({sl.players.length})</span></button><button onClick={()=>setSavedShortlists(prev=>prev.filter(s=>s.id!==sl.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#3f3f46',padding:2}}><X size={10}/></button></div>)}</>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Player modal */}
      {selectedPlayer&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16}} onClick={e=>e.target===e.currentTarget&&setSelectedPlayer(null)}>
          <div style={{background:'#0A0714',border:'0.5px solid rgba(139,92,246,0.3)',borderRadius:18,maxWidth:620,width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{padding:'22px 24px',borderBottom:'0.5px solid rgba(139,92,246,0.15)',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:20,fontWeight:600,marginBottom:3}}>{selectedPlayer.name}</div>
                <div style={{fontSize:12,color:'#8b5cf6'}}>{selectedPlayer.position} · {selectedPlayer.league} · Age {selectedPlayer.age}</div>
                {selectedPlayer.badge.icon&&<div style={{marginTop:8,display:'inline-flex',alignItems:'center',gap:5,background:'rgba(124,58,237,0.1)',border:'0.5px solid rgba(139,92,246,0.25)',borderRadius:99,padding:'3px 10px',fontSize:12,color:'#c4b5fd'}}>{selectedPlayer.badge.icon} {selectedPlayer.badge.label}</div>}
              </div>
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{textAlign:'center'}}><div style={{fontSize:44,fontWeight:700,fontFamily:'monospace',color:scoreColor(selectedPlayer.valueScore),lineHeight:1}}>{selectedPlayer.valueScore}</div><div style={{fontSize:10,color:'#52525b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Value Score</div></div>
                <button onClick={()=>setSelectedPlayer(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#52525b',padding:4,marginTop:4}}><X size={18}/></button>
              </div>
            </div>
            <div style={{padding:'20px 24px'}}>
              <div style={{marginBottom:20}}>
                <StatBar label="Performance (stats)" value={selectedPlayer.perfPercent} color="#10b981"/>
                <StatBar label="Value for money" value={selectedPlayer.valuePercent} color="#8b5cf6"/>
                <StatBar label="Age factor" value={selectedPlayer.agePercent} color="#a78bfa"/>
                {selectedPlayer.percentileInLeague!==undefined&&<StatBar label="League percentile" value={selectedPlayer.percentileInLeague} color="#f59e0b"/>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
                {[{label:'Transfer value',value:selectedPlayer.transferValue},{label:'Weekly wage',value:selectedPlayer.wage}].map(({label,value})=>(
                  <div key={label} style={{background:'rgba(255,255,255,0.03)',border:'0.5px solid rgba(139,92,246,0.12)',borderRadius:9,padding:'11px 14px'}}><div style={{fontSize:10,color:'#52525b',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{label}</div><div style={{fontWeight:500,fontSize:14}}>{value}</div></div>
                ))}
              </div>
              <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:'#71717a',display:'flex',alignItems:'center',gap:5}}><BarChart3 size={13}/> All stats</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:18}}>
                {Object.entries(selectedPlayer.rawData).map(([key,value])=>(
                  <div key={key} style={{background:'rgba(255,255,255,0.02)',border:'0.5px solid rgba(139,92,246,0.08)',borderRadius:7,padding:'8px 11px'}}><div style={{fontSize:9,color:'#3f3f46',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>{key}</div><div style={{fontSize:12,fontWeight:500}}>{String(value)}</div></div>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>addToShortlist(selectedPlayer)} style={{flex:1,padding:'9px 0',borderRadius:8,border:'none',cursor:'pointer',background:'#7c3aed',color:'white',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><Star size={13}/> Add to shortlist</button>
                <button onClick={()=>exportTransferReport(selectedPlayer)} style={{padding:'9px 16px',borderRadius:8,border:'0.5px solid rgba(16,185,129,0.3)',background:'rgba(16,185,129,0.08)',color:'#10b981',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:5}}><FileText size={13}/> PDF Report</button>
                <button onClick={()=>copyName(selectedPlayer)} style={{padding:'9px 14px',borderRadius:8,border:'0.5px solid rgba(139,92,246,0.2)',background:'none',color:'#71717a',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:5}}><Copy size={13}/>{copiedId===selectedPlayer.id?'✓':'Copy'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics overlay */}
      {showAnalytics&&(
        <AnalyticsDashboard
          players={players}
          shortlist={shortlist}
          onAddToShortlist={addToShortlist}
          onRemoveFromShortlist={removeFromShortlist}
          onClose={()=>setShowAnalytics(false)}
        />
      )}

      <footer style={{borderTop:'0.5px solid rgba(139,92,246,0.12)',padding:'20px',textAlign:'center',fontSize:11,color:'#3f3f46',marginTop:32}}>
        <div style={{display:'flex',justifyContent:'center',gap:20,marginBottom:10}}>
          <a href="https://twitter.com/JakeSummersFM" target="_blank" style={{color:'#52525b',textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:12}}><AtSign size={13} style={{color:'#38bdf8'}}/> @JakeSummersFM</a>
          <a href="https://www.twitch.tv/jakesummersfm" target="_blank" style={{color:'#52525b',textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:12}}><Tv size={13} style={{color:'#a78bfa'}}/> Twitch</a>
          <a href="https://ko-fi.com/jakesummersfm" target="_blank" style={{color:'#52525b',textDecoration:'none',display:'flex',alignItems:'center',gap:4,fontSize:12}}><Heart size={13} style={{color:'#f87171'}}/> Ko-fi</a>
        </div>
        FM Value Scout V5 Enhanced · Made for the FM community
      </footer>
    </div>
  );
}
