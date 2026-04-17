'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, X, BarChart3, Heart, FileText, Tv, AtSign,
  Users, HelpCircle, Trash2, Copy, Image as ImageIcon, ChevronUp,
  ChevronDown, Star, AlertTriangle, TrendingUp, Shield, Zap, Eye,
  CheckCircle, Info, ArrowRight, Grid, List
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  SortingState, flexRender, ColumnDef
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  badge: { type: 'gem' | 'overpriced' | 'overrated' | 'avoid' | 'none'; label: string; icon: string };
  perfPercent: number;
  valuePercent: number;
  agePercent: number;
}

type Tab = 'upload' | 'howto' | 'filters' | 'squad' | 'compare' | 'screenshot';

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITION_FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'GK', value: 'GK' },
  { label: 'Wing-Back', value: 'Wing Back' },
  { label: 'CB', value: 'Central Defender' },
  { label: 'CDM', value: 'CDM' },
  { label: 'CM', value: 'Centre Mid' },
  { label: 'AM', value: 'Attacking Mid' },
  { label: 'Winger', value: 'Winger' },
  { label: 'ST', value: 'Striker' },
];

const RECOMMENDED_COLUMNS: Record<string, string[]> = {
  'Central Defender': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Itc'],
  'CDM':              ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Itc', 'Key', 'Pas %'],
  'Wing Back':        ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Itc', 'Key', 'Ast'],
  'Centre Mid':       ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Key', 'Ast'],
  'Attacking Mid':    ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Gls', 'Ast', 'Key', 'Shots', 'xG'],
  'Winger':           ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Gls', 'Ast', 'Key', 'Shots', 'xG'],
  'Striker':          ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Gls', 'Ast', 'Shots', 'xG'],
  'GK':               ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Sv %', 'Clean Sheets'],
  'All':              ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes'],
};

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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getPositionGroup(pos: string): string {
  const p = (pos || '').toLowerCase();
  if (p.includes('gk')) return 'GK';
  if (p.includes('wing back') || p.includes(' wb') || p.startsWith('wb')) return 'Wing Back';
  if (p.includes('d (c)') || p.includes('cb') || p.includes('central def')) return 'Central Defender';
  if (p.includes('dm')) return 'CDM';
  if (p.includes('am')) return 'Attacking Mid';
  if (p.includes('cm') || p.includes('m (c)')) return 'Centre Mid';
  if (p.includes('winger') || p.includes('rw') || p.includes('lw') || p.includes('m/am (r') || p.includes('m/am (l')) return 'Winger';
  if (p.includes('st') || p.includes('cf') || p.includes('fw')) return 'Striker';
  return 'Central Defender';
}

function getLeagueMultiplier(league: string): number {
  const l = (league || '').toLowerCase();
  if (['premier', 'bundesliga', 'la liga', 'serie a', 'ligue 1'].some(s => l.includes(s))) return 1.25;
  if (l.includes('championship') || l.includes('segunda') || l.includes('serie b')) return 1.12;
  return 1.0;
}

function parseNum(row: Record<string, unknown>, keys: string[], def = 0): number {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/ /g, '')];
    if (val !== undefined) {
      const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (!isNaN(n)) return n;
    }
  }
  return def;
}

function calculateValueScore(row: Record<string, unknown>, position: string, league: string, balanced: boolean) {
  const minutes = parseNum(row, ['Minutes', 'Mins', 'Min'], 90) || 90;
  const per90 = (s: number) => (minutes > 0 ? s / (minutes / 90) : s);

  const goals        = per90(parseNum(row, ['Goals', 'Gls']));
  const assists      = per90(parseNum(row, ['Assists', 'Ast']));
  const xG           = per90(parseNum(row, ['xG']));
  const keyPasses    = per90(parseNum(row, ['Key Passes', 'KP', 'Key']));
  const shots        = per90(parseNum(row, ['Shots', 'Sh']));
  const tackles      = per90(parseNum(row, ['Tackles', 'Tck C', 'Tck']));
  const interceptions = per90(parseNum(row, ['Interceptions', 'Itc']));
  const savePct      = parseNum(row, ['Sv %', 'Save %']);
  const cleanSheets  = parseNum(row, ['Clean Sheets', 'CS']);

  let performance = 0;
  if (position === 'GK') {
    performance = Math.min(42, savePct * 1.85 + (cleanSheets / (minutes / 90)) * 8);
  } else if (['Central Defender', 'CDM', 'Wing Back'].includes(position)) {
    performance = tackles * 4.2 + interceptions * 4.0 + keyPasses * 1.5 + minutes / 100;
  } else {
    const xgBonus = xG > 0 ? (goals / xG) * 50 : goals * 40;
    performance = goals * 3.8 + assists * 2.4 + xgBonus + shots * 0.9 + keyPasses * 1.8;
  }

  const leagueMultiplier = getLeagueMultiplier(league);
  const baseScore = performance * 2.45;
  const valueM = Math.max(0.3, parseNum(row, ['Transfer Value'], 0.5));
  const wageK  = Math.max(0.5, (parseNum(row, ['Wage'], 1000)) / 1000);
  const efficiency = Math.min(45, Math.max(25, 88 / (valueM * 0.45 + wageK * 0.55)));

  const age = parseInt(String(row.Age ?? 25)) || 25;
  const ageBonus = age <= 21 ? 16 : age <= 23 ? 11 : age <= 26 ? 7 : age >= 33 ? -12 : 0;
  const minutesFactor = minutes < 800 ? 0.65 : minutes < 1200 ? 0.78 : 1.0;

  let final = ((baseScore * 0.55) + (efficiency * 0.33) + ageBonus) * minutesFactor * leagueMultiplier;
  if (balanced) final *= 0.92;

  const score = Math.max(48, Math.min(97, Math.round(final)));
  const denom = Math.max(final, 1);
  return {
    score,
    perfPercent:  Math.min(100, Math.round((baseScore  * 0.55 / denom) * 100)) || 65,
    valuePercent: Math.min(100, Math.round((efficiency * 0.33 / denom) * 100)) || 60,
    agePercent:   Math.min(100, Math.round((Math.abs(ageBonus) / denom) * 100)) || 45,
  };
}

function calculateBadge(score: number, valueM: number, age: number): Player['badge'] {
  if (score >= 88 && (age <= 23 || valueM <= 12)) return { type: 'gem',       label: 'Hidden Gem',  icon: '💎' };
  if (score < 60  && valueM > 25)                  return { type: 'avoid',     label: "Don't Touch", icon: '🚫' };
  if (score >= 82 && valueM > 40)                  return { type: 'overpriced',label: 'Overpriced',  icon: '⚠️' };
  if (score < 72  && valueM < 10)                  return { type: 'overrated', label: 'Overrated',   icon: '🔥' };
  return { type: 'none', label: '', icon: '' };
}

function scoreColor(s: number) {
  if (s >= 85) return '#10b981';
  if (s >= 75) return '#8b5cf6';
  if (s >= 65) return '#f59e0b';
  return '#ef4444';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{
      fontFamily: 'monospace', fontWeight: 700, fontSize: 18,
      color: scoreColor(score),
    }}>{score}</span>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'monospace', color }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-background-secondary)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-secondary)' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14 }}>{body}</div>
    </div>
  );
}

function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors: Record<string, [string, string]> = {
    default: ['var(--color-background-secondary)', 'var(--color-text-secondary)'],
    success: ['#d1fae5', '#065f46'],
    warning: ['#fef3c7', '#78350f'],
    danger:  ['#fee2e2', '#7f1d1d'],
    info:    ['#ede9fe', '#4c1d95'],
  };
  const [bg, fg] = colors[variant];
  return (
    <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.03em' }}>
      {children}
    </span>
  );
}

// ─── Player card (used in shortlist + compare) ────────────────────────────────

function PlayerCard({ player, onRemove, compact = false }: { player: Player; onRemove?: () => void; compact?: boolean }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: compact ? '12px 16px' : '16px 20px',
      position: 'relative',
    }}>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', padding: 4,
        }}><X size={14} /></button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: compact ? 14 : 15 }}>{player.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {player.position} · {player.age}y · {player.league}
          </div>
        </div>
        <ScoreBadge score={player.valueScore} />
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TAB_CONFIG: { id: Tab; label: string; icon?: React.ReactNode }[] = [
  { id: 'upload',     label: 'Upload CSV' },
  { id: 'howto',      label: 'How to Use',   icon: <HelpCircle size={14} /> },
  { id: 'filters',    label: 'Export Filters' },
  { id: 'squad',      label: 'Squad Builder', icon: <Users size={14} /> },
  { id: 'compare',    label: 'Compare' },
  { id: 'screenshot', label: 'Screenshot', icon: <ImageIcon size={14} /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FMValueScoutV5() {
  const [players,        setPlayers]        = useState<Player[]>([]);
  const [shortlist,      setShortlist]      = useState<Player[]>([]);
  const [squad,          setSquad]          = useState<(Player | null)[]>(Array(11).fill(null));
  const [posFilter,      setPosFilter]      = useState('All');
  const [sorting,        setSorting]        = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging,     setIsDragging]     = useState(false);
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [uploadMsg,      setUploadMsg]      = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab,      setActiveTab]      = useState<Tab>('upload');
  const [balanced,       setBalanced]       = useState(false);
  const [copiedId,       setCopiedId]       = useState<number | null>(null);
  const [formation,      setFormation]      = useState('4-3-3');
  const [compareA,       setCompareA]       = useState<Player | null>(null);
  const [compareB,       setCompareB]       = useState<Player | null>(null);
  const [viewMode,       setViewMode]       = useState<'table' | 'cards'>('table');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Processing ──────────────────────────────────────────────────────────────

  const buildPlayer = useCallback((row: Record<string, unknown>, index: number, idBase: number): Player => {
    const rawPos  = String(row.Position ?? row.Pos ?? '');
    const group   = getPositionGroup(rawPos);
    const league  = String(row.League ?? row.Division ?? '');
    const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league, balanced);
    const valueM  = Math.max(0.3, parseNum(row, ['Transfer Value'], 0.5));
    const age     = parseInt(String(row.Age ?? 25)) || 25;

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
          ? `Tck: ${row['Tck C'] ?? '-'} | Itc: ${row['Itc'] ?? '-'}`
          : `Key: ${row['Key'] ?? row['Key Passes'] ?? '-'}`,
      transferValue: String(row['Transfer Value'] ?? '£0'),
      wage: String(row.Wage ?? '£0'),
      rawData: row,
      badge: calculateBadge(score, valueM, age),
      perfPercent,
      valuePercent,
      agePercent,
    };
  }, [balanced]);

  const parseAndProcessCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setUploadMsg(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const base = Date.now();
        const parsed = (results.data as Record<string, unknown>[])
          .map((row, i) => buildPlayer(row, i, base))
          .sort((a, b) => b.valueScore - a.valueScore)
          .map((p, i) => ({ ...p, rank: i + 1 }));
        setPlayers(parsed);
        setUploadMsg({ type: 'success', text: `Loaded ${parsed.length} players successfully` });
        setIsProcessing(false);
        setActiveTab('upload');
      },
      error: () => {
        setUploadMsg({ type: 'error', text: 'Failed to parse CSV – check the file format' });
        setIsProcessing(false);
      },
    });
  }, [buildPlayer]);

  const handleFile = useCallback((file: File) => {
    if (file.name.toLowerCase().endsWith('.csv')) parseAndProcessCSV(file);
    else setUploadMsg({ type: 'error', text: 'Please upload a .csv file' });
  }, [parseAndProcessCSV]);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() =>
    posFilter === 'All' ? players : players.filter(p => p.position === posFilter),
    [players, posFilter]);

  // ── Shortlist helpers ───────────────────────────────────────────────────────

  const addToShortlist = (p: Player) => {
    if (!shortlist.find(s => s.id === p.id)) setShortlist(prev => [...prev, p]);
  };
  const removeFromShortlist = (id: number) => setShortlist(prev => prev.filter(p => p.id !== id));

  const copyName = (p: Player) => {
    navigator.clipboard.writeText(p.name);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // ── Exports ─────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (!shortlist.length) return;
    const rows = ['Player,Age,Position,League,Score,Value,Wage',
      ...shortlist.map(p => `${p.name},${p.age},${p.position},${p.league},${p.valueScore},${p.transferValue},${p.wage}`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows);
    a.download = 'valuescout-shortlist.csv';
    a.click();
  };

  const exportPDF = () => {
    if (!shortlist.length) return;
    const doc = new jsPDF();
    doc.text('FM Value Scout V5 — Shortlist', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Player', 'Position', 'Age', 'League', 'Score', 'Value', 'Wage']],
      body: shortlist.map(p => [p.name, p.position, p.age, p.league, p.valueScore, p.transferValue, p.wage]),
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] },
    });
    doc.save('ValueScout_Shortlist.pdf');
  };

  // ── Squad builder ───────────────────────────────────────────────────────────

  const slots = FORMATION_SLOTS[formation];
  const squadStats = useMemo(() => {
    const filled = squad.filter(Boolean) as Player[];
    if (!filled.length) return { avgScore: 0, avgAge: 0, gems: 0 };
    return {
      avgScore: Math.round(filled.reduce((s, p) => s + p.valueScore, 0) / filled.length),
      avgAge:   parseFloat((filled.reduce((s, p) => s + p.age, 0) / filled.length).toFixed(1)),
      gems:     filled.filter(p => p.badge.type === 'gem').length,
    };
  }, [squad]);

  // ── Table definition ────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Player>[]>(() => [
    { accessorKey: 'rank', header: '#', size: 50 },
    {
      accessorKey: 'name', header: 'Player',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{row.original.name}</div>
          {row.original.badge.icon && (
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {row.original.badge.icon} {row.original.badge.label}
            </span>
          )}
        </div>
      ),
    },
    { accessorKey: 'position', header: 'Pos', size: 120 },
    { accessorKey: 'age',      header: 'Age', size: 60 },
    { accessorKey: 'league',   header: 'League' },
    { accessorKey: 'keyStat',  header: 'Key Stat',   enableSorting: false },
    {
      accessorKey: 'valueScore', header: 'Score',
      cell: ({ row }) => <ScoreBadge score={row.original.valueScore} />,
      size: 80,
    },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        const inShortlist = !!shortlist.find(s => s.id === p.id);
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSelectedPlayer(p)} title="View details" style={{
              background: 'none', border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)', padding: '4px 10px', cursor: 'pointer',
              fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 4,
            }}><Eye size={13} /> View</button>
            <button onClick={() => copyName(p)} title="Copy name" style={{
              background: 'none', border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)', padding: '4px 10px', cursor: 'pointer',
              fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 4,
            }}><Copy size={13} />{copiedId === p.id ? 'Copied!' : 'Copy'}</button>
            <button onClick={() => inShortlist ? removeFromShortlist(p.id) : addToShortlist(p)} style={{
              background: inShortlist ? '#ede9fe' : 'none',
              border: '0.5px solid ' + (inShortlist ? '#8b5cf6' : 'var(--color-border-secondary)'),
              borderRadius: 'var(--border-radius-md)', padding: '4px 10px', cursor: 'pointer',
              fontSize: 13, color: inShortlist ? '#4c1d95' : 'var(--color-text-primary)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Star size={13} fill={inShortlist ? 'currentColor' : 'none'} />
              {inShortlist ? 'Listed' : 'Shortlist'}
            </button>
          </div>
        );
      },
    },
  ], [shortlist, copiedId]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A1F', color: '#e4e4e7', fontFamily: 'var(--font-sans)' }}>

      {/* Nav */}
      <nav style={{
        borderBottom: '0.5px solid rgba(139,92,246,0.25)',
        background: 'rgba(15,10,31,0.92)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 24px',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, background: '#7c3aed', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, letterSpacing: '-0.5px',
            }}>VS</div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 16 }}>FM Value Scout</div>
              <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: -2 }}>V5 · Moneyball Scouting</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: '#a1a1aa', cursor: 'pointer', padding: '6px 12px',
            }}>
              <input type="checkbox" checked={balanced} onChange={e => setBalanced(e.target.checked)}
                style={{ accentColor: '#7c3aed' }} />
              Balanced mode
            </label>
            <button onClick={exportCSV} disabled={!shortlist.length} style={{
              background: '#7c3aed', border: 'none', borderRadius: 8,
              color: 'white', padding: '8px 16px', fontSize: 13, cursor: shortlist.length ? 'pointer' : 'not-allowed',
              opacity: shortlist.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6,
            }}><Download size={15} /> CSV ({shortlist.length})</button>
            <button onClick={exportPDF} disabled={!shortlist.length} style={{
              background: '#059669', border: 'none', borderRadius: 8,
              color: 'white', padding: '8px 16px', fontSize: 13, cursor: shortlist.length ? 'pointer' : 'not-allowed',
              opacity: shortlist.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6,
            }}><FileText size={15} /> PDF</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px', display: 'flex', gap: 24 }}>

        {/* Sidebar */}
        <aside style={{ width: 200, flexShrink: 0 }}>
          <div style={{
            background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)',
            borderRadius: 16, padding: 16, position: 'sticky', top: 88,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Position
            </div>
            {POSITION_FILTERS.map(f => (
              <button key={f.value} onClick={() => setPosFilter(f.value)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', marginBottom: 4, borderRadius: 8,
                fontSize: 13, cursor: 'pointer', border: 'none',
                background: posFilter === f.value ? '#7c3aed' : 'transparent',
                color: posFilter === f.value ? 'white' : '#a1a1aa',
                fontWeight: posFilter === f.value ? 500 : 400,
                transition: 'all 0.15s',
              }}>{f.label}</button>
            ))}

            {players.length > 0 && (
              <>
                <div style={{ height: 0.5, background: 'rgba(139,92,246,0.25)', margin: '16px 0' }} />
                <div style={{ fontSize: 12, fontWeight: 500, color: '#8b5cf6', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Summary
                </div>
                {[
                  { label: 'Total', value: players.length },
                  { label: 'Filtered', value: filtered.length },
                  { label: 'Shortlisted', value: shortlist.length },
                  { label: 'Gems', value: players.filter(p => p.badge.type === 'gem').length + ' 💎' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#a1a1aa' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(139,92,246,0.25)', marginBottom: 24, gap: 0, overflowX: 'auto' }}>
            {TAB_CONFIG.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === t.id ? 500 : 400,
                color: activeTab === t.id ? '#8b5cf6' : '#71717a',
                borderBottom: activeTab === t.id ? '2px solid #7c3aed' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                transition: 'all 0.15s', marginBottom: -0.5,
              }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Upload tab ── */}
          {activeTab === 'upload' && (
            <div>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                style={{
                  border: `2px dashed ${isDragging ? '#7c3aed' : 'rgba(139,92,246,0.4)'}`,
                  borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                  background: isDragging ? 'rgba(124,58,237,0.06)' : 'rgba(24,18,43,0.5)',
                  transition: 'all 0.2s', cursor: 'pointer', marginBottom: 24,
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={36} style={{ color: '#7c3aed', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 6 }}>
                  Drop your FM CSV here, or click to browse
                </div>
                <div style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>
                  Use the BepInEx Player Export mod to generate a CSV from FM26
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {isProcessing && <div style={{ color: '#8b5cf6', fontSize: 13 }}>Processing…</div>}
                {uploadMsg && (
                  <div style={{
                    fontSize: 13, marginTop: 12, padding: '8px 16px', borderRadius: 8, display: 'inline-block',
                    background: uploadMsg.type === 'success' ? '#d1fae5' : uploadMsg.type === 'warning' ? '#fef3c7' : '#fee2e2',
                    color:      uploadMsg.type === 'success' ? '#065f46' : uploadMsg.type === 'warning' ? '#78350f' : '#7f1d1d',
                  }}>{uploadMsg.text}</div>
                )}
              </div>

              {/* Table / cards */}
              {players.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: '#71717a' }}>
                      Showing <strong style={{ color: '#e4e4e7' }}>{filtered.length}</strong> players
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['table', 'cards'] as const).map(m => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                          background: viewMode === m ? 'rgba(124,58,237,0.15)' : 'none',
                          border: '0.5px solid ' + (viewMode === m ? '#7c3aed' : 'rgba(139,92,246,0.25)'),
                          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                          color: viewMode === m ? '#8b5cf6' : '#71717a', fontSize: 13,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {m === 'table' ? <List size={14} /> : <Grid size={14} />}
                          {m === 'table' ? 'Table' : 'Cards'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {viewMode === 'table' ? (
                    <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 16, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id} style={{ borderBottom: '0.5px solid rgba(139,92,246,0.2)', background: 'rgba(15,10,31,0.6)' }}>
                              {hg.headers.map(h => (
                                <th key={h.id}
                                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                                  style={{
                                    padding: '12px 16px', textAlign: 'left', fontSize: 12,
                                    fontWeight: 500, color: '#8b5cf6', cursor: h.column.getCanSort() ? 'pointer' : 'default',
                                    userSelect: 'none', letterSpacing: '0.05em', textTransform: 'uppercase',
                                  }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                    {h.column.getIsSorted() === 'asc'  && <ChevronUp   size={12} />}
                                    {h.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
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
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
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

          {/* ── How to use tab ── */}
          {activeTab === 'howto' && (
            <div style={{ maxWidth: 720 }}>
              {[
                {
                  step: '1', title: 'Export from FM26',
                  body: 'In FM26, go to your Scouting Centre or Player Search. Install the BepInEx Player Export mod, then use it to export any player list as a CSV. Make sure to add all the recommended columns before exporting.',
                  icon: <Upload size={18} />,
                },
                {
                  step: '2', title: 'Choose the right columns',
                  body: 'The Value Score algorithm needs specific columns to work accurately. Use the "Export Filters" tab to see exactly which columns to add for each position.',
                  icon: <List size={18} />,
                },
                {
                  step: '3', title: 'Upload your CSV',
                  body: 'Drag and drop your CSV onto the Upload tab, or click to browse. The tool will automatically detect positions and calculate a Value Score (48–97) for every player.',
                  icon: <CheckCircle size={18} />,
                },
                {
                  step: '4', title: 'Read the scores',
                  body: 'Green scores (85+) = excellent value. Purple (75–84) = solid pick. Amber (65–74) = borderline. Red (<65) = avoid or overpriced. Badges like 💎 Hidden Gem flag standout opportunities.',
                  icon: <BarChart3 size={18} />,
                },
                {
                  step: '5', title: 'Build your shortlist',
                  body: 'Click Shortlist on any player to add them. Export your shortlist as CSV or PDF for sharing. Use the Squad Builder tab to drag players into a formation.',
                  icon: <Star size={18} />,
                },
              ].map(({ step, title, body, icon }) => (
                <div key={step} style={{
                  display: 'flex', gap: 16, marginBottom: 20,
                  background: 'rgba(24,18,43,0.7)', border: '0.5px solid rgba(139,92,246,0.2)',
                  borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: '#8b5cf6',
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>{step}. {title}</div>
                    <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>{body}</div>
                  </div>
                </div>
              ))}

              <div style={{ background: 'rgba(124,58,237,0.08)', border: '0.5px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '16px 20px', marginTop: 8 }}>
                <div style={{ fontSize: 13, color: '#c4b5fd', fontWeight: 500, marginBottom: 4 }}>Balanced Mode</div>
                <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
                  Toggle in the top bar to apply a 8% score reduction across all players. Useful when a dataset feels inflated — it tightens the spread without changing the relative order.
                </div>
              </div>
            </div>
          )}

          {/* ── Export filters tab ── */}
          {activeTab === 'filters' && (
            <div>
              <div style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 20, maxWidth: 600 }}>
                Add these columns to your FM player list view before exporting via the BepInEx mod. More columns = more accurate scores.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {Object.entries(RECOMMENDED_COLUMNS).filter(([k]) => k !== 'All').map(([pos, cols]) => (
                  <div key={pos} style={{
                    background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)',
                    borderRadius: 12, padding: '16px 20px',
                  }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 12, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={14} />{pos}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cols.map(col => (
                        <code key={col} style={{
                          fontSize: 12, padding: '2px 8px', borderRadius: 6,
                          background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
                          fontFamily: 'var(--font-mono)', border: '0.5px solid rgba(139,92,246,0.2)',
                        }}>{col}</code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(5,150,105,0.1)', border: '0.5px solid rgba(5,150,105,0.3)', borderRadius: 10, fontSize: 13, color: '#6ee7b7', maxWidth: 560 }}>
                <strong>Tip:</strong> Always include Name, Age, Position, Transfer Value, Wage, League and Minutes as a minimum. Everything else improves score accuracy for specific positions.
              </div>
            </div>
          )}

          {/* ── Squad builder tab ── */}
          {activeTab === 'squad' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, color: '#a1a1aa' }}>Formation:</div>
                {Object.keys(FORMATION_SLOTS).map(f => (
                  <button key={f} onClick={() => { setFormation(f); setSquad(Array(FORMATION_SLOTS[f].length).fill(null)); }} style={{
                    padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    background: formation === f ? '#7c3aed' : 'rgba(24,18,43,0.8)',
                    color: formation === f ? 'white' : '#a1a1aa',
                    border: formation === f ? 'none' : '0.5px solid rgba(139,92,246,0.25)',
                  }}>{f}</button>
                ))}
                <button onClick={() => setSquad(Array(slots.length).fill(null))} style={{
                  marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  background: 'none', border: '0.5px solid rgba(239,68,68,0.4)', color: '#f87171',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}><Trash2 size={13} /> Clear</button>
              </div>

              {/* Stats row */}
              {squad.some(Boolean) && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Avg score', value: squadStats.avgScore, color: scoreColor(squadStats.avgScore) },
                    { label: 'Avg age',   value: squadStats.avgAge,   color: '#a1a1aa' },
                    { label: 'Hidden gems', value: `${squadStats.gems} 💎`, color: '#a78bfa' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      flex: 1, background: 'rgba(24,18,43,0.7)', border: '0.5px solid rgba(139,92,246,0.2)',
                      borderRadius: 10, padding: '12px 16px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 500, color }}>{value}</div>
                      <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 20 }}>
                {/* Formation grid */}
                <div style={{
                  flex: 1, background: 'rgba(5,46,22,0.3)', border: '0.5px solid rgba(34,197,94,0.15)',
                  borderRadius: 16, padding: 20, minHeight: 420,
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(255,255,255,0.03) 60px, rgba(255,255,255,0.03) 61px)',
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
                            const p = shortlist.find(s => s.id === id);
                            if (p) { const s = [...squad]; s[i] = p; setSquad(s); }
                          }}
                          style={{
                            background: assigned ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                            border: '0.5px solid ' + (assigned ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'),
                            borderRadius: 10, padding: '10px 8px', textAlign: 'center', minHeight: 72,
                            cursor: 'default', transition: 'all 0.15s',
                          }}>
                          <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{slot.label}</div>
                          {assigned ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 2 }}>
                                {assigned.name.split(' ').slice(-1)[0]}
                              </div>
                              <div style={{ fontSize: 11, color: scoreColor(assigned.valueScore), fontWeight: 500 }}>{assigned.valueScore}</div>
                              <button onClick={() => { const s = [...squad]; s[i] = null; setSquad(s); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', marginTop: 2, padding: 0 }}>
                                <X size={10} />
                              </button>
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: '#52525b' }}>Drop here</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shortlist drag panel */}
                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#8b5cf6', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Shortlist ({shortlist.length})
                  </div>
                  {shortlist.length === 0 && (
                    <EmptyState icon={<Star />} title="No players shortlisted" body="Add players from the Upload tab first." />
                  )}
                  {shortlist.map(p => (
                    <div key={p.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('playerId', p.id.toString())}
                      style={{
                        background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)',
                        borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'grab',
                        userSelect: 'none',
                      }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#71717a', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span>{p.position} · {p.age}y</span>
                        <span style={{ color: scoreColor(p.valueScore), fontWeight: 500 }}>{p.valueScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Compare tab ── */}
          {activeTab === 'compare' && (
            <div>
              {players.length === 0 ? (
                <EmptyState icon={<BarChart3 />} title="No players loaded" body="Upload a CSV first to compare players." />
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    {([compareA, compareB] as const).map((sel, idx) => (
                      <div key={idx}>
                        <div style={{ fontSize: 12, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                          Player {idx + 1}
                        </div>
                        <select
                          value={sel?.id ?? ''}
                          onChange={e => {
                            const p = players.find(pl => pl.id === parseInt(e.target.value)) ?? null;
                            idx === 0 ? setCompareA(p) : setCompareB(p);
                          }}
                          style={{ width: '100%', padding: '8px 12px', background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#e4e4e7', fontSize: 13 }}>
                          <option value="">Select a player…</option>
                          {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position}, {p.age}y)</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {compareA && compareB && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        {[compareA, compareB].map(p => <PlayerCard key={p.id} player={p} />)}
                      </div>

                      <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Score breakdown</div>
                        {[
                          { label: 'Value Score', a: compareA.valueScore, b: compareB.valueScore, max: 97 },
                          { label: 'Performance %', a: compareA.perfPercent, b: compareB.perfPercent, max: 100 },
                          { label: 'Value for money %', a: compareA.valuePercent, b: compareB.valuePercent, max: 100 },
                          { label: 'Age factor %', a: compareA.agePercent, b: compareB.agePercent, max: 100 },
                        ].map(({ label, a, b, max }) => (
                          <div key={label} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#71717a', marginBottom: 6 }}>
                              <span style={{ color: scoreColor(a), fontWeight: 500 }}>{a}</span>
                              <span>{label}</span>
                              <span style={{ color: scoreColor(b), fontWeight: 500 }}>{b}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--color-background-secondary)', borderRadius: 99, overflow: 'hidden', direction: 'rtl' }}>
                                <div style={{ height: '100%', width: `${(a / max) * 100}%`, background: scoreColor(a), borderRadius: 99 }} />
                              </div>
                              <div style={{ width: 6, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                              <div style={{ flex: 1, height: 6, background: 'var(--color-background-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(b / max) * 100}%`, background: scoreColor(b), borderRadius: 99 }} />
                              </div>
                            </div>
                          </div>
                        ))}

                        <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', fontSize: 13, color: '#c4b5fd' }}>
                          {compareA.valueScore > compareB.valueScore
                            ? `💡 ${compareA.name} scores ${compareA.valueScore - compareB.valueScore} points higher — better value overall.`
                            : compareA.valueScore < compareB.valueScore
                            ? `💡 ${compareB.name} scores ${compareB.valueScore - compareA.valueScore} points higher — better value overall.`
                            : '💡 Both players have identical Value Scores — check the breakdown for differences.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {(!compareA || !compareB) && (
                    <EmptyState icon={<ArrowRight />} title="Select two players above" body="Use the dropdowns to pick any two players from your loaded data." />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Screenshot tab ── */}
          {activeTab === 'screenshot' && (
            <div style={{ maxWidth: 640 }}>
              <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 32, textAlign: 'center', marginBottom: 20 }}>
                <ImageIcon size={36} style={{ color: '#7c3aed', margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 8 }}>Screenshot upload (beta)</div>
                <div style={{ fontSize: 13, color: '#71717a', marginBottom: 20, lineHeight: 1.6 }}>
                  Take clear, high-res screenshots of FM player lists. The app uses OCR to extract data — accuracy depends heavily on image quality. For best results, use the BepInEx CSV export instead.
                </div>
                <label style={{
                  background: '#7c3aed', color: 'white', padding: '10px 24px',
                  borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-block',
                }}>
                  Choose screenshots
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
                <strong>Accuracy warning:</strong> OCR is inherently imperfect. Extracted names, ages and positions may contain errors. Always verify shortlisted players in-game before making transfers.
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar — shortlist */}
        {shortlist.length > 0 && (
          <aside style={{ width: 240, flexShrink: 0 }}>
            <div style={{
              background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)',
              borderRadius: 16, padding: 16, position: 'sticky', top: 88,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Shortlist ({shortlist.length})
                </div>
                <button onClick={() => setShortlist([])} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#71717a',
                  fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                }}><Trash2 size={11} /> Clear</button>
              </div>
              {shortlist.map(p => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '0.5px solid rgba(139,92,246,0.1)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>{p.position} · {p.age}y</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: scoreColor(p.valueScore) }}>{p.valueScore}</span>
                    <button onClick={() => removeFromShortlist(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 2 }}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* ── Player modal ── */}
      {selectedPlayer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
        }} onClick={e => e.target === e.currentTarget && setSelectedPlayer(null)}>
          <div style={{
            background: '#0F0A1F', border: '0.5px solid rgba(139,92,246,0.3)',
            borderRadius: 20, maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '0.5px solid rgba(139,92,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{selectedPlayer.name}</div>
                <div style={{ fontSize: 13, color: '#8b5cf6' }}>
                  {selectedPlayer.position} · {selectedPlayer.league} · Age {selectedPlayer.age}
                </div>
                {selectedPlayer.badge.icon && (
                  <div style={{ marginTop: 8 }}>
                    <Tag variant="info">{selectedPlayer.badge.icon} {selectedPlayer.badge.label}</Tag>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'monospace', color: scoreColor(selectedPlayer.valueScore), lineHeight: 1 }}>
                    {selectedPlayer.valueScore}
                  </div>
                  <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Value Score</div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {/* Score bars */}
              <div style={{ marginBottom: 24 }}>
                <StatBar label="Performance (stats based)" value={selectedPlayer.perfPercent} color="#10b981" />
                <StatBar label="Value for money"            value={selectedPlayer.valuePercent} color="#8b5cf6" />
                <StatBar label="Age factor"                 value={selectedPlayer.agePercent}   color="#a78bfa" />
              </div>

              {/* Value & wage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Transfer value', value: selectedPlayer.transferValue },
                  { label: 'Weekly wage',    value: selectedPlayer.wage },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* All stats */}
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={14} style={{ color: '#8b5cf6' }} /> All exported stats
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {Object.entries(selectedPlayer.rawData).map(([key, value]) => (
                  <div key={key} style={{ background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.1)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{key}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{String(value)}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => addToShortlist(selectedPlayer)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#7c3aed', color: 'white', fontSize: 14, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}><Star size={14} /> Add to shortlist</button>
                <button onClick={() => copyName(selectedPlayer)} style={{
                  padding: '10px 20px', borderRadius: 8, border: '0.5px solid rgba(139,92,246,0.3)',
                  background: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}><Copy size={14} />{copiedId === selectedPlayer.id ? 'Copied!' : 'Copy name'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '0.5px solid rgba(139,92,246,0.2)', padding: '24px', textAlign: 'center', fontSize: 12, color: '#52525b', marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
          <a href="https://twitter.com/JakeSummersFM"   target="_blank" style={{ color: '#71717a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <AtSign size={14} style={{ color: '#38bdf8' }} /> @JakeSummersFM
          </a>
          <a href="https://www.twitch.tv/jakesummersfm" target="_blank" style={{ color: '#71717a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <Tv size={14} style={{ color: '#a78bfa' }} /> Twitch
          </a>
          <a href="https://ko-fi.com/jakesummersfm"     target="_blank" style={{ color: '#71717a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <Heart size={14} style={{ color: '#f87171' }} /> Ko-fi
          </a>
        </div>
        FM Value Scout V5 · Made for the FM community
      </footer>
    </div>
  );
}
