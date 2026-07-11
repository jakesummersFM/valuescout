'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, X, BarChart3, FileText,
  Users, HelpCircle, Trash2, Copy, Eye, AlertCircle,
  CheckCircle, Star, ChevronUp, ChevronDown, LayoutGrid, List,
  Target, Zap, DollarSign, Filter, Settings, Info, ChevronRight,
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  SortingState, flexRender, ColumnDef
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Player {
  id: number;
  rank: number;
  name: string;
  age: number;
  position: PlayerPosition;
  league: string;
  valueScore: number;
  transferValueM: number;
  transferValueDisplay: string;
  valueEstimated: boolean;
  wageK: number;
  wageDisplay: string;
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

type Tab = 'upload' | 'data-hub' | 'squad' | 'compare' | 'setup' | 'guide';
type PlayerPosition = 'GK' | 'Wing Back' | 'Central Defender' | 'CDM' | 'Attacking Mid' | 'Centre Mid' | 'Winger' | 'Striker';
type FormationKey = keyof typeof FORMATION_SLOTS;
type ViewMode = 'table' | 'cards';
type CsvRow = Record<string, unknown>;
type UploadMessage = { type: 'success' | 'warning' | 'error'; text: string };
type TagVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
type StatMetricKey =
  | 'savePct'
  | 'cleanSheetsP90'
  | 'tacklesP90'
  | 'interceptionsP90'
  | 'keyPassesP90'
  | 'passCompletion'
  | 'goalsP90'
  | 'assistsP90'
  | 'xGP90'
  | 'shotP90';

interface StatMetric {
  key: StatMetricKey;
  label: string;
  value: number;
  suffix: string;
  benchmark: number;
}

interface InsightMetric extends StatMetric {
  percentile: number;
}

interface MoneyParseResult {
  value: number | null;
  monthly: boolean;
}

interface StatBarProps {
  label: string;
  value: number;
  color: string;
}

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}

interface P90StatsGridProps {
  player: Player;
}

interface RadarChartProps {
  statsList: StatMetric[];
  size?: number;
}

interface PositionScatterChartProps {
  players: Player[];
  position: PlayerPosition;
  selectedId: number;
  width?: number;
  height?: number;
}

interface PlayerCardProps {
  player: Player;
  onRemove?: () => void;
}

interface AccordionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const POSITION_FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'GK', value: 'GK' },
  { label: 'CB', value: 'Central Defender' },
  { label: 'FB', value: 'Wing Back' },
  { label: 'CDM', value: 'CDM' },
  { label: 'CM', value: 'Centre Mid' },
  { label: 'CAM', value: 'Attacking Mid' },
  { label: 'Winger', value: 'Winger' },
  { label: 'ST', value: 'Striker' },
];

const MAIN_TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'upload', label: 'Upload CSV', icon: <Upload size={14} /> },
  { id: 'data-hub', label: 'Data Hub', icon: <Zap size={14} /> },
  { id: 'squad', label: 'Squad Builder', icon: <Users size={14} /> },
  { id: 'compare', label: 'Compare', icon: <BarChart3 size={14} /> },
  { id: 'setup', label: 'Setup Guide', icon: <Settings size={14} /> },
  { id: 'guide', label: 'Help', icon: <HelpCircle size={14} /> },
];

const VIEW_MODES: ViewMode[] = ['table', 'cards'];

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

// Position-specific column checklist shown in the Setup Guide tab
const SETUP_COLUMNS: Record<string, string[]> = {
  'Goalkeepers': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Save %', 'Clean Sheets'],
  'Centre Backs': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Tackles', 'Interceptions', 'Pass %'],
  'Fullbacks / Wing Backs': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Tackles', 'Interceptions', 'Assists', 'Key Passes', 'Pass %'],
  'Defensive Mid (CDM)': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Tackles', 'Interceptions', 'Key Passes', 'Pass %'],
  'Centre Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Key Passes', 'Assists', 'Tackles', 'Pass %'],
  'Attacking Mid / Winger': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Goals', 'Assists', 'Key Passes', 'Shots', 'xG', 'xA'],
  'Striker': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Apps', 'Goals', 'Assists', 'Shots', 'xG', 'xA'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROBUST PARSING — handles the real-world export tool's format
// ═══════════════════════════════════════════════════════════════════════════════

/** Strips BOM + whitespace from CSV headers */
function cleanHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim();
}

const INVALID_VALUE_STRINGS = ['unknown', 'not for sale', 'n/a', 'na', '-', '--', 'none', ''];

/**
 * Parses a "smart" number from any format the export tool throws at us:
 * - European decimal commas: "0,7" -> 0.7
 * - Plain numbers: "1850" -> 1850
 * - Returns null (not 0) if the value is genuinely missing/invalid,
 *   so callers can apply their own fallback logic.
 */
function parseSmartNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let str = String(raw).trim();
  if (!str) return null;
  if (INVALID_VALUE_STRINGS.includes(str.toLowerCase())) return null;

  // European decimal comma -> dot (e.g. "0,7" -> "0.7")
  // Safe here because raw stat columns in these exports never use commas
  // as thousands separators (values are small: tackles, goals, percentages).
  str = str.replace(',', '.');
  str = str.replace(/[^0-9.\-]/g, '');
  if (!str || str === '-' || str === '.') return null;

  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/** Same as parseSmartNumber but with a fallback default instead of null */
function parseNum(row: CsvRow, keys: string[], def = 0): number {
  for (const key of keys) {
    const raw = row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/ /g, '')];
    const n = parseSmartNumber(raw);
    if (n !== null) return Math.max(0, n);
  }
  return def;
}

/**
 * Parses money values in ANY format the export tool produces:
 * - "€45M" -> 45,000,000
 * - "€5,25K - €7,75K p/m" -> average of range, flagged as monthly
 * - "Unknown" / "Not for Sale" / "N/A" -> null (caller applies fallback)
 * Returns { value: euros|null, monthly: boolean }
 */
function parseMoneyString(raw: unknown): MoneyParseResult {
  if (raw === null || raw === undefined) return { value: null, monthly: false };
  let str = String(raw).trim();
  if (!str) return { value: null, monthly: false };
  if (INVALID_VALUE_STRINGS.includes(str.toLowerCase())) return { value: null, monthly: false };

  const monthly = /p\s*\/\s*m/i.test(str);
  str = str.replace(/p\s*\/\s*[mw]/gi, '').trim();

  // Range: "€10K - €50K" -> average both sides
  if (str.includes(' - ')) {
    const parts = str.split(' - ').map((part): MoneyParseResult => parseMoneyString(part));
    const nums = parts
      .map((part) => part.value)
      .filter((value): value is number => value !== null);
    if (!nums.length) return { value: null, monthly };
    const avg = nums.reduce((left, right) => left + right, 0) / nums.length;
    return { value: avg, monthly };
  }

  str = str.replace(/[€£$¥]/g, '').trim();

  let multiplier = 1;
  if (/m$/i.test(str)) { multiplier = 1000000; str = str.replace(/m$/i, ''); }
  else if (/k$/i.test(str)) { multiplier = 1000; str = str.replace(/k$/i, ''); }

  // European decimal comma -> dot (e.g. "5,25K" -> "5.25" * 1000)
  str = str.replace(/,/g, '.');
  str = str.replace(/[^0-9.\-]/g, '');
  if (!str) return { value: null, monthly };

  const num = parseFloat(str);
  if (isNaN(num)) return { value: null, monthly };
  return { value: num * multiplier, monthly };
}

/**
 * Reads a stat that might already be exported as per-90 (e.g. "Cln/90")
 * OR as a raw season total (e.g. "Clean Sheets") needing conversion.
 * Checks per-90 column variants FIRST to avoid double-converting.
 */
function readStatSmart(row: CsvRow, rawAliases: string[], per90Aliases: string[], minutes: number): number {
  for (const key of per90Aliases) {
    const raw = row[key] ?? row[key.toLowerCase()];
    const n = parseSmartNumber(raw);
    if (n !== null) return Math.max(0, n);
  }
  const rawTotal = parseNum(row, rawAliases, 0);
  return minutes > 0 ? Math.max(0, (rawTotal / minutes) * 90) : 0;
}

function pickFirstRaw(row: CsvRow, keys: string[]): unknown {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/ /g, '')];
    if (val !== null && val !== undefined && String(val).trim() !== '') return val;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getPositionGroup(pos: unknown): PlayerPosition {
  const p = `${pos ?? ''}`.toLowerCase().trim();
  if (p.includes('gk') || p === 'goalkeeper') return 'GK';
  if (p.includes('wing back') || p.includes('wb') || p.includes('fullback') || p.includes('d (r') || p.includes('d (l')) return 'Wing Back';
  if (p.includes('d (c)') || p.includes('cb') || p.includes('centre def') || p.includes('center def')) return 'Central Defender';
  if (p.includes('dm') || p.includes('d m')) return 'CDM';
  if (p.includes('am') || p.includes('attacking mid') || p.includes('a m')) return 'Attacking Mid';
  if (p.includes('cm') || p.includes('c m') || p.includes('centre mid')) return 'Centre Mid';
  if (p.includes('winger') || p.includes('rw') || p.includes('lw') || p.includes('m/am') || p.includes('wide')) return 'Winger';
  if (p.includes('st') || p.includes('cf') || p.includes('fw') || p.includes('striker')) return 'Striker';
  return 'Central Defender';
}

function getLeagueMultiplier(league: unknown): number {
  if (!league) return 1.0;
  const l = `${league ?? ''}`.toLowerCase();
  if (['premier', 'bundesliga', 'la liga', 'laliga', 'serie a', 'ligue 1'].some(s => l.includes(s)) && !l.includes('2')) return 1.25;
  if (['championship', 'segunda', 'serie b', 'liga 2', 'liga portugal 2', 'efl league one'].some(s => l.includes(s))) return 1.12;
  return 1.0;
}

function calculateP90Stats(row: CsvRow, position: PlayerPosition, transferValueM: number, wageK: number): P90StatsType {
  const minutes = Math.max(1, parseNum(row, ['Minutes', 'Mins', 'Min'], 90));
  const apps = Math.max(1, parseNum(row, ['Apps', 'Appearances'], 1));

  const goalsP90 = readStatSmart(row, ['Goals', 'Gls'], ['Goals/90', 'Gls/90'], minutes);
  const assistsP90 = readStatSmart(row, ['Assists', 'Ast'], ['Assists/90', 'Ast/90'], minutes);
  const xGP90 = readStatSmart(row, ['xG'], ['xG/90'], minutes);
  const xAP90 = readStatSmart(row, ['xA'], ['xA/90'], minutes);
  const keyPassesP90 = readStatSmart(row, ['Key Passes', 'KP', 'Key'], ['Key Passes/90', 'KP/90'], minutes);
  const shotP90 = readStatSmart(row, ['Shots', 'Sh'], ['Shots/90', 'Sh/90'], minutes);
  const tacklesP90 = readStatSmart(row, ['Tackles', 'Tck C', 'Tck'], ['Tackles/90', 'Tck/90'], minutes);
  const interceptionsP90 = readStatSmart(row, ['Interceptions', 'Itc'], ['Interceptions/90', 'Itc/90'], minutes);
  const passCompletion = parseNum(row, ['Pas %', 'Pass %'], 80);
  const savePct = parseNum(row, ['Sv %', 'Save %'], 0);
  // "Cln/90" is ALREADY per-90 in the export tool — check that alias first
  const cleanSheetsP90 = readStatSmart(row, ['Clean Sheets', 'CS'], ['Cln/90', 'CS/90', 'Clean Sheets/90'], minutes);

  const goalsTotal = parseNum(row, ['Goals', 'Gls'], 0);
  const assistsTotal = parseNum(row, ['Assists', 'Ast'], 0);
  const costPerGoal = goalsTotal > 0 ? Math.round((transferValueM * 1000000) / goalsTotal) : 0;
  const costPerAssist = assistsTotal > 0 ? Math.round((transferValueM * 1000000) / assistsTotal) : 0;

  // Moneyball performance is now POSITION-SPECIFIC, not just goals/assists/key passes.
  // A brilliant cheap centre-back was previously scored ~0 on moneyball just because
  // he doesn't record assists — this fixes that.
  let performanceSum = 0;
  if (position === 'GK') {
    performanceSum = (savePct / 100) * 3 + cleanSheetsP90 * 2;
  } else if (position === 'Central Defender') {
    performanceSum = (tacklesP90 + interceptionsP90) / 3 + keyPassesP90 * 0.5;
  } else if (position === 'CDM') {
    performanceSum = (tacklesP90 + interceptionsP90) / 3 + keyPassesP90 * 0.6 + assistsP90 * 1.0;
  } else if (position === 'Wing Back') {
    performanceSum = ((tacklesP90 + interceptionsP90) / 3) * 0.8 + assistsP90 * 1.5 + keyPassesP90 * 0.5;
  } else {
    // Centre Mid, Attacking Mid, Winger, Striker — attacking/creative output
    performanceSum = goalsP90 + assistsP90 + keyPassesP90;
  }
  performanceSum = Math.max(0.01, performanceSum);

  const costSum = Math.max(0.01, transferValueM * 0.5 + wageK * 0.5);
  const moneyballIndex = parseFloat((performanceSum / costSum).toFixed(2));

  return {
    goalsP90: parseFloat(goalsP90.toFixed(2)),
    assistsP90: parseFloat(assistsP90.toFixed(2)),
    xGP90: parseFloat(xGP90.toFixed(2)),
    xAP90: parseFloat(xAP90.toFixed(2)),
    keyPassesP90: parseFloat(keyPassesP90.toFixed(2)),
    shotP90: parseFloat(shotP90.toFixed(2)),
    tacklesP90: parseFloat(tacklesP90.toFixed(2)),
    interceptionsP90: parseFloat(interceptionsP90.toFixed(2)),
    passCompletion, savePct,
    cleanSheetsP90: parseFloat(cleanSheetsP90.toFixed(2)),
    minutesPlayed: minutes,
    appearances: apps,
    costPerGoal, costPerAssist,
    moneyballIndex: Math.min(moneyballIndex, 9.99),
  };
}

function calculateValueScore(
  row: CsvRow,
  position: PlayerPosition,
  league: string,
  transferValueM: number,
  wageK: number,
  balanced: boolean,
): { score: number; perfPercent: number; valuePercent: number; agePercent: number } {
  try {
    const minutes = Math.max(1, parseNum(row, ['Minutes', 'Mins', 'Min'], 90));

    const goalsP90 = readStatSmart(row, ['Goals', 'Gls'], ['Goals/90', 'Gls/90'], minutes);
    const assistsP90 = readStatSmart(row, ['Assists', 'Ast'], ['Assists/90', 'Ast/90'], minutes);
    const xGP90 = readStatSmart(row, ['xG'], ['xG/90'], minutes);
    const keyPassesP90 = readStatSmart(row, ['Key Passes', 'KP', 'Key'], ['Key Passes/90', 'KP/90'], minutes);
    const shotsP90 = readStatSmart(row, ['Shots', 'Sh'], ['Shots/90', 'Sh/90'], minutes);
    const tacklesP90 = readStatSmart(row, ['Tackles', 'Tck C', 'Tck'], ['Tackles/90', 'Tck/90'], minutes);
    const interceptionsP90 = readStatSmart(row, ['Interceptions', 'Itc'], ['Interceptions/90', 'Itc/90'], minutes);
    const passCompletion = Math.min(100, Math.max(0, parseNum(row, ['Pas %', 'Pass %'], 80)));
    const savePct = Math.min(100, Math.max(0, parseNum(row, ['Sv %', 'Save %'], 0)));
    const cleanSheetsP90 = readStatSmart(row, ['Clean Sheets', 'CS'], ['Cln/90', 'CS/90', 'Clean Sheets/90'], minutes);

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
    const valueM = Math.max(0.1, transferValueM);
    const wK = Math.max(0.1, wageK);
    const efficiency = Math.min(45, Math.max(20, 88 / (valueM * 0.45 + wK * 0.55)));

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
  if (score >= 88 && age <= 23 && minutes > 900) return { type: 'gem', label: 'Hidden Gem', icon: '💎' };
  if (score >= 82 && valueM <= 8 && minutes > 500) return { type: 'bargain', label: 'Bargain', icon: '🤑' };
  if (moneyballIndex > 0.8 && score >= 75 && minutes > 600) return { type: 'gem', label: 'Moneyball Star', icon: '⭐' };
  if (score < 55 && valueM > 30) return { type: 'avoid', label: 'Avoid', icon: '🚫' };
  if (score >= 80 && valueM > 50) return { type: 'overpriced', label: 'Overpriced', icon: '⚠️' };
  return { type: 'none', label: '', icon: '' };
}

function scoreColor(s: number): string {
  if (s >= 85) return '#10b981';
  if (s >= 75) return '#8b5cf6';
  if (s >= 65) return '#f59e0b';
  if (s >= 55) return '#ef4444';
  return '#dc2626';
}

function formatMoney(m: number): string {
  if (m >= 1) return `£${m.toFixed(1)}M`;
  return `£${Math.round(m * 1000)}K`;
}

/** Downloads a header-only CSV template so users know exactly which columns to export */
function downloadTemplate(positionLabel: string, columns: string[]): void {
  const csv = columns.join(',');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TEMPLATE_${positionLabel.replace(/[^a-z0-9]+/gi, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatBar({ label, value, color }: StatBarProps) {
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

function Tag({ children, variant = 'default' }: TagProps) {
  const colors: Record<TagVariant, [string, string]> = {
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

function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#a1a1aa' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#e4e4e7', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14 }}>{body}</div>
    </div>
  );
}

function getStatsForPosition(position: PlayerPosition, stats: P90StatsType): StatMetric[] {
  if (position === 'GK') {
    return [
      { key: 'savePct', label: 'Save %', value: stats.savePct, suffix: '%', benchmark: 75 },
      { key: 'cleanSheetsP90', label: 'Clean Sheets/90', value: stats.cleanSheetsP90, suffix: '', benchmark: 0.5 },
    ];
  }
  if (['Central Defender', 'CDM', 'Wing Back'].includes(position)) {
    return [
      { key: 'tacklesP90', label: 'Tackles/90', value: stats.tacklesP90, suffix: '', benchmark: 2.5 },
      { key: 'interceptionsP90', label: 'Interceptions/90', value: stats.interceptionsP90, suffix: '', benchmark: 2.0 },
      { key: 'keyPassesP90', label: 'Key Passes/90', value: stats.keyPassesP90, suffix: '', benchmark: 1.5 },
      { key: 'passCompletion', label: 'Pass %', value: stats.passCompletion, suffix: '%', benchmark: 85 },
    ];
  }
  if (position === 'Attacking Mid') {
    return [
      { key: 'goalsP90', label: 'Goals/90', value: stats.goalsP90, suffix: '', benchmark: 0.35 },
      { key: 'assistsP90', label: 'Assists/90', value: stats.assistsP90, suffix: '', benchmark: 0.25 },
      { key: 'xGP90', label: 'xG/90', value: stats.xGP90, suffix: '', benchmark: 0.4 },
      { key: 'keyPassesP90', label: 'Key Passes/90', value: stats.keyPassesP90, suffix: '', benchmark: 2.5 },
    ];
  }
  return [
    { key: 'goalsP90', label: 'Goals/90', value: stats.goalsP90, suffix: '', benchmark: position === 'Striker' ? 0.4 : 0.35 },
    { key: 'assistsP90', label: 'Assists/90', value: stats.assistsP90, suffix: '', benchmark: 0.2 },
    { key: 'xGP90', label: 'xG/90', value: stats.xGP90, suffix: '', benchmark: position === 'Striker' ? 0.45 : 0.4 },
    { key: 'shotP90', label: 'Shots/90', value: stats.shotP90, suffix: '', benchmark: 2.5 },
  ];
}

function P90StatsGrid({ player }: P90StatsGridProps) {
  const stats = player.p90Stats;
  const position = player.position as PlayerPosition;
  const statsList = getStatsForPosition(position, stats);

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
        {statsList.map(({ label, value, suffix, benchmark }) => {
          const numValue = value;
          const percentBench = Math.min(100, (numValue / benchmark) * 100);
          const barColor = percentBench >= 100 ? '#10b981' : percentBench >= 80 ? '#8b5cf6' : percentBench >= 60 ? '#f59e0b' : '#ef4444';
          return (
            <div key={label} style={{ background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.1)', borderRadius: 8, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: barColor }}>{numValue.toFixed(2)}{suffix}</div>
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
                <div style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>{formatMoney(stats.costPerGoal / 1000000)}</div>
              </div>
            )}
            {stats.costPerAssist > 0 && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '12px' }}>
                <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cost per assist</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}>{formatMoney(stats.costPerAssist / 1000000)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED DATA HUB VISUALS — radar (star) chart, scatter/dot chart, auto-insights
// ═══════════════════════════════════════════════════════════════════════════════

/** Hand-rolled SVG radar/star chart — no chart library dependency needed */
function RadarChart({ statsList, size = 240 }: RadarChartProps) {
  const n = statsList.length;
  if (n < 3) return null; // needs 3+ axes to read as a shape

  const center = size / 2;
  const radius = size / 2 - 40;
  const angleStep = (2 * Math.PI) / n;
  const CAP = 1.5; // 150% of benchmark = full radius, so elite performers don't clip

  const pointFor = (i: number, fraction: number): [number, number] => {
    const angle = angleStep * i - Math.PI / 2;
    const r = radius * Math.max(0, Math.min(1, fraction));
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const labelPointFor = (i: number): [number, number] => {
    const angle = angleStep * i - Math.PI / 2;
    const r = radius + 24;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const toPath = (points: [number, number][]): string => points.map((point) => point.join(',')).join(' ');

  const playerPoints = statsList.map((s, i) => pointFor(i, Math.min(s.value / s.benchmark, CAP) / CAP));
  const benchmarkPoints = statsList.map((_, i) => pointFor(i, 1 / CAP));

  return (
    <svg width={size} height={size} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
      {[0.33, 0.66, 1].map((f, ri) => (
        <polygon key={ri} points={toPath(statsList.map((_, i) => pointFor(i, f)))} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}
      {statsList.map((_, i) => {
        const [x, y] = pointFor(i, 1);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}
      <polygon points={toPath(benchmarkPoints)} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
      <polygon points={toPath(playerPoints)} fill="rgba(16,185,129,0.25)" stroke="#10b981" strokeWidth={2} />
      {playerPoints.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5} fill="#10b981" />)}
      {statsList.map((s, i) => {
        const [x, y] = labelPointFor(i);
        return (
          <text key={i} x={x} y={y} fill="#a1a1aa" fontSize={10} textAnchor="middle" dominantBaseline="middle">
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}

/** Dot/scatter chart: where this player sits vs same-position peers on Score × Moneyball */
function PositionScatterChart({ players, position, selectedId, width = 320, height = 200 }: PositionScatterChartProps) {
  const peers = players.filter(p => p.position === position);
  if (peers.length < 2) return null;

  const scores = peers.map(p => p.valueScore);
  const moneyballs = peers.map(p => p.p90Stats.moneyballIndex);
  const minScore = Math.min(...scores) - 2;
  const maxScore = Math.max(...scores) + 2;
  const maxMB = Math.max(1.2, ...moneyballs) * 1.1;
  const pad = 28;

  const xScale = (v: number): number => pad + ((v - minScore) / ((maxScore - minScore) || 1)) * (width - pad * 2);
  const yScale = (v: number): number => height - pad - (v / (maxMB || 1)) * (height - pad * 2);

  return (
    <svg width={width} height={height}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.15)" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(255,255,255,0.15)" />
      <text x={width / 2} y={height - 8} fill="#71717a" fontSize={9} textAnchor="middle">Value Score →</text>
      <text x={10} y={height / 2} fill="#71717a" fontSize={9} textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`}>Moneyball →</text>
      {peers.map(p => (
        <circle
          key={p.id}
          cx={xScale(p.valueScore)}
          cy={yScale(p.p90Stats.moneyballIndex)}
          r={p.id === selectedId ? 6 : 3}
          fill={p.id === selectedId ? '#10b981' : 'rgba(139,92,246,0.45)'}
          stroke={p.id === selectedId ? '#fff' : 'none'}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

/** Auto-generated strengths/weaknesses vs same-position peers in the loaded dataset */
function generateInsights(player: Player, players: Player[]): { strengths: InsightMetric[]; weaknesses: InsightMetric[] } {
  const peers = players.filter(p => p.position === player.position && p.id !== player.id);
  if (peers.length < 3) return { strengths: [], weaknesses: [] };

  const statsList = getStatsForPosition(player.position as PlayerPosition, player.p90Stats);
  const scored = statsList.map(s => {
    const peerValues = peers.map(p => p.p90Stats[s.key]);
    const below = peerValues.filter(v => v <= s.value).length;
    const percentile = Math.round((below / peerValues.length) * 100);
    return { ...s, percentile };
  });

  const sorted = [...scored].sort((a, b) => b.percentile - a.percentile);
  const strengths = sorted.filter(s => s.percentile >= 65).slice(0, 2);
  const weaknesses = sorted.filter(s => s.percentile <= 35).slice(-2);

  return { strengths, weaknesses };
}

/** Nearest same-position alternatives by value score — useful if the target isn't affordable */
function getSimilarPlayers(player: Player, players: Player[], count = 3): Array<Player & { diff: number }> {
  return players
    .filter(p => p.position === player.position && p.id !== player.id)
    .map(p => ({ ...p, diff: Math.abs(p.valueScore - player.valueScore) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, count);
}

function PlayerCard({ player, onRemove }: PlayerCardProps) {
  return (
    <div style={{ background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '16px 20px', position: 'relative' }}>
      {onRemove && (
        <button onClick={onRemove} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 4 }}>
          <X size={14} />
        </button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{player.name}</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{player.position} · {player.age}y · {player.league}</div>
        </div>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: scoreColor(player.valueScore) }}>{player.valueScore}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {player.badge.icon && <Tag variant="info">{player.badge.icon} {player.badge.label}</Tag>}
        <Tag>{player.transferValueDisplay}{player.valueEstimated ? ' (est.)' : ''}</Tag>
        <Tag>{player.wageDisplay}</Tag>
      </div>
    </div>
  );
}

/** Simple accordion used in the Setup Guide tab */
function Accordion({ title, icon, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', background: 'rgba(24,18,43,0.5)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#e4e4e7',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
          {icon}{title}
        </span>
        {open ? <ChevronDown size={16} color="#8b5cf6" /> : <ChevronRight size={16} color="#71717a" />}
      </button>
      {open && <div style={{ padding: '0 16px 16px 16px' }}>{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FMValueScoutV7() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [squad, setSquad] = useState<Array<Player | null>>(Array(11).fill(null));
  const [posFilter, setPosFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<UploadMessage | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [balanced, setBalanced] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [compareA, setCompareA] = useState<Player | null>(null);
  const [compareB, setCompareB] = useState<Player | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const buildPlayer = useCallback((row: CsvRow, index: number, idBase: number): Player => {
    const rawPos = String(pickFirstRaw(row, ['Position', 'Pos']) ?? '');
    const group = getPositionGroup(rawPos);
    const league = String(pickFirstRaw(row, ['League', 'Division']) ?? '');

    // Transfer value: handles ranges, currency, "Unknown", "Not for Sale"
    const tvParsed = parseMoneyString(pickFirstRaw(row, ['Transfer Value', 'Value']));
    const valueEstimated = tvParsed.value === null;
    const transferValueM = tvParsed.value !== null ? tvParsed.value / 1000000 : 0.5;

    // Wage: handles monthly ("p/m") vs weekly, ranges, currency
    const wageParsed = parseMoneyString(pickFirstRaw(row, ['Wage', 'Salary']));
    let wageEurosWeekly = wageParsed.value;
    if (wageEurosWeekly !== null && wageParsed.monthly) wageEurosWeekly = wageEurosWeekly / 4.345;
    const wageK = wageEurosWeekly !== null ? Math.max(0.1, wageEurosWeekly / 1000) : 1;

    const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league, transferValueM, wageK, balanced);
    const age = Math.max(16, Math.min(40, parseInt(String(pickFirstRaw(row, ['Age']) ?? 25)) || 25));
    const minutes = Math.max(1, parseNum(row, ['Minutes', 'Mins', 'Min'], 90));
    const p90Stats = calculateP90Stats(row, group, transferValueM, wageK);

    return {
      id: idBase + index,
      rank: index + 1,
      name: String(pickFirstRaw(row, ['Name', 'Player']) ?? 'Unknown'),
      age,
      position: group,
      league,
      valueScore: score,
      transferValueM,
      transferValueDisplay: formatMoney(transferValueM),
      valueEstimated,
      wageK,
      wageDisplay: `£${Math.round(wageK)}K p/w`,
      rawData: row,
      badge: calculateBadge(score, transferValueM, age, minutes, p90Stats.moneyballIndex),
      perfPercent, valuePercent, agePercent,
      p90Stats,
    };
  }, [balanced]);

  const parseAndProcessCSV = useCallback((file: File): void => {
    setIsProcessing(true);
    setUploadMsg(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: cleanHeader, // strips BOM + whitespace, so "Player" etc. matches cleanly
      complete: (results: Papa.ParseResult<CsvRow>) => {
        try {
          const base = Date.now();
          const rows = results.data;
          const validRows = rows.filter(row => row && Object.keys(row).length > 0 && pickFirstRaw(row, ['Name', 'Player']));

          if (validRows.length === 0) {
            setUploadMsg({ type: 'error', text: 'No valid player rows found. Check your export includes a Name/Player column.' });
            setIsProcessing(false);
            return;
          }

          const parsed = validRows
            .map((row, i) => buildPlayer(row, i, base))
            .sort((a, b) => b.valueScore - a.valueScore)
            .map((p, i) => ({ ...p, rank: i + 1 }));

          const estimatedCount = parsed.filter(p => p.valueEstimated).length;
          const suffix = estimatedCount > 0 ? ` | ⚠️ ${estimatedCount} had unreadable Transfer Value (using estimate)` : '';
          setPlayers(parsed);
          setUploadMsg({ type: estimatedCount > 0 ? 'warning' : 'success', text: `✓ Loaded ${parsed.length} players${suffix}` });
          setActiveTab('upload');
        } catch (e) {
          setUploadMsg({ type: 'error', text: `Parse error: ${e instanceof Error ? e.message : 'Unknown error'}` });
        }
        setIsProcessing(false);
      },
      error: (err: Error) => {
        setUploadMsg({ type: 'error', text: `CSV Error: ${err.message || 'Failed to parse'}` });
        setIsProcessing(false);
      },
    });
  }, [buildPlayer]);

  const handleFile = useCallback((file: File): void => {
    if (file.name.toLowerCase().endsWith('.csv')) parseAndProcessCSV(file);
    else setUploadMsg({ type: 'error', text: 'Only .csv files supported' });
  }, [parseAndProcessCSV]);

  const filtered = useMemo(() => {
    let result = posFilter === 'All' ? players : players.filter(p => p.position === posFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.league.toLowerCase().includes(term) ||
        p.position.toLowerCase().includes(term)
      );
    }
    return result;
  }, [players, posFilter, searchTerm]);

  const addToShortlist = useCallback((p: Player): void => {
    setShortlist((prev) => (prev.find((savedPlayer) => savedPlayer.id === p.id) ? prev : [...prev, p]));
  }, []);

  const removeFromShortlist = useCallback((id: number): void => {
    setShortlist((prev) => prev.filter((player) => player.id !== id));
  }, []);

  const copyName = useCallback((p: Player): void => {
    navigator.clipboard.writeText(p.name);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  // Percentile of this player's score & moneyball vs the rest of the loaded dataset
  const getPercentile = useCallback((player: Player, key: 'valueScore' | 'moneyballIndex'): number | null => {
    if (players.length < 2) return null;
    const values = key === 'valueScore' ? players.map(p => p.valueScore) : players.map(p => p.p90Stats.moneyballIndex);
    const target = key === 'valueScore' ? player.valueScore : player.p90Stats.moneyballIndex;
    const below = values.filter(v => v <= target).length;
    return Math.round((below / values.length) * 100);
  }, [players]);

  const exportCSV = () => {
    if (!shortlist.length) return;
    const headers = ['Player', 'Age', 'Position', 'League', 'Score', 'Moneyball', 'Value', 'Wage'];
    const rows = shortlist.map(p => [p.name, p.age, p.position, p.league, p.valueScore, p.p90Stats.moneyballIndex.toFixed(2), p.transferValueDisplay, p.wageDisplay]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'valuescout-shortlist.csv';
    a.click();
  };

  const exportPDF = () => {
    if (!shortlist.length) return;
    const doc = new jsPDF();
    doc.text('FM Value Scout — Shortlist', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Player', 'Pos', 'Age', 'League', 'Score', 'Moneyball', 'Value']],
      body: shortlist.map(p => [p.name, p.position, p.age, p.league, p.valueScore, p.p90Stats.moneyballIndex.toFixed(2), p.transferValueDisplay]),
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
    });
    doc.save('ValueScout_Shortlist.pdf');
  };

  const slots = FORMATION_SLOTS[formation];
  const selectedPlayerScorePercentile = selectedPlayer ? getPercentile(selectedPlayer, 'valueScore') : null;
  const squadStats = useMemo(() => {
    const filled = squad.filter((player): player is Player => player !== null);
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
          {row.original.badge.icon && <span style={{ fontSize: 10, color: '#71717a' }}>{row.original.badge.icon} {row.original.badge.label}</span>}
        </div>
      ),
      size: 160,
    },
    { accessorKey: 'position', header: 'Pos', size: 100 },
    { accessorKey: 'age', header: 'Age', size: 50 },
    { accessorKey: 'league', header: 'League', size: 120 },
    {
      accessorKey: 'valueScore', header: 'Score',
      cell: ({ row }) => <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: scoreColor(row.original.valueScore) }}>{row.original.valueScore}</span>,
      size: 70,
    },
    {
      accessorKey: 'p90Stats.moneyballIndex', header: 'Moneyball 🎯',
      cell: ({ row }) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: row.original.p90Stats.moneyballIndex > 0.7 ? '#10b981' : row.original.p90Stats.moneyballIndex > 0.6 ? '#f59e0b' : '#ef4444' }}>
          {row.original.p90Stats.moneyballIndex.toFixed(2)}
        </span>
      ),
      size: 100,
    },
    {
      id: 'value', header: 'Value',
      cell: ({ row }) => (
        <span style={{ fontSize: 12, color: '#a1a1aa' }}>
          {row.original.transferValueDisplay}{row.original.valueEstimated && <span title="Estimated — export tool gave no readable value" style={{ color: '#f59e0b', marginLeft: 4 }}>~</span>}
        </span>
      ),
      size: 90,
    },
    {
      id: 'actions', header: '', enableSorting: false, size: 120,
      cell: ({ row }) => {
        const p = row.original;
        const inShortlist = !!shortlist.find(s => s.id === p.id);
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setSelectedPlayer(p); setActiveTab('data-hub'); }} style={{
              background: 'rgba(139,92,246,0.1)', border: '0.5px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '4px 10px',
              cursor: 'pointer', fontSize: 12, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4,
            }}><Eye size={12} /> Hub</button>
            <button onClick={() => inShortlist ? removeFromShortlist(p.id) : addToShortlist(p)} style={{
              background: inShortlist ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${inShortlist ? '#8b5cf6' : 'rgba(139,92,246,0.2)'}`, borderRadius: 6, padding: '4px 10px',
              cursor: 'pointer', fontSize: 12, color: inShortlist ? '#8b5cf6' : '#a1a1aa', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Star size={12} fill={inShortlist ? 'currentColor' : 'none'} />
              {inShortlist ? 'Saved' : 'Save'}
            </button>
          </div>
        );
      },
    },
  ], [addToShortlist, removeFromShortlist, shortlist]);

  const table = useReactTable({
    data: filtered, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A1F', color: '#e4e4e7', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <nav style={{ borderBottom: '0.5px solid rgba(139,92,246,0.25)', background: 'rgba(15,10,31,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50, padding: '0 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, letterSpacing: '-1px' }}>VS</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>FM Value Scout</div>
              <div style={{ fontSize: 11, color: '#a78bfa', marginTop: -2 }}>V7 · P/90 Moneyball</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', background: 'rgba(24,18,43,0.9)',
              border: '0.5px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 12px', width: 240,
            }}>
              <input
                type="text"
                placeholder="Search name, league, position…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e4e4e7', fontSize: 13, width: '100%' }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a1a1aa', cursor: 'pointer', padding: '6px 12px' }}>
              <input type="checkbox" checked={balanced} onChange={e => setBalanced(e.target.checked)} style={{ accentColor: '#7c3aed' }} />
              Balanced
            </label>
            <button onClick={exportCSV} disabled={!shortlist.length} style={{ background: '#7c3aed', border: 'none', borderRadius: 8, color: 'white', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: shortlist.length ? 'pointer' : 'not-allowed', opacity: shortlist.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={14} /> CSV</button>
            <button onClick={exportPDF} disabled={!shortlist.length} style={{ background: '#059669', border: 'none', borderRadius: 8, color: 'white', padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: shortlist.length ? 'pointer' : 'not-allowed', opacity: shortlist.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> PDF</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', display: 'flex', gap: 24 }}>
        <aside style={{ width: 240, flexShrink: 0 }}>
          <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 16, position: 'sticky', top: 88 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={12} /> Position Filter
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {POSITION_FILTERS.map(f => (
                <button key={f.value} onClick={() => setPosFilter(f.value)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                  fontSize: 13, cursor: 'pointer', border: 'none',
                  background: posFilter === f.value ? '#7c3aed' : 'transparent',
                  color: posFilter === f.value ? 'white' : '#a1a1aa',
                  fontWeight: posFilter === f.value ? 600 : 400,
                }}>{f.label}</button>
              ))}
            </div>
            {players.length > 0 && (
              <>
                <div style={{ height: 0.5, background: 'rgba(139,92,246,0.25)', margin: '16px 0' }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Summary</div>
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

        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(139,92,246,0.25)', marginBottom: 24, gap: 0, overflowX: 'auto' }}>
            {MAIN_TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? '#8b5cf6' : '#71717a',
                borderBottom: activeTab === t.id ? '2px solid #7c3aed' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', marginBottom: -0.5,
              }}>{t.icon}{t.label}</button>
            ))}
          </div>

          {activeTab === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                style={{
                  border: `2px dashed ${isDragging ? '#7c3aed' : 'rgba(139,92,246,0.4)'}`, borderRadius: 16, padding: '48px 24px',
                  textAlign: 'center', background: isDragging ? 'rgba(124,58,237,0.06)' : 'rgba(24,18,43,0.5)',
                  cursor: 'pointer', marginBottom: 24,
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={40} style={{ color: '#7c3aed', margin: '0 auto 16px', opacity: 0.8 }} />
                <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Drop your player export CSV here</div>
                <div style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 16 }}>
                  or click to browse · works with the Player Export tool&apos;s format automatically
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {isProcessing && <div style={{ color: '#8b5cf6', fontSize: 14, fontWeight: 500 }}>⏳ Processing your data...</div>}
                {uploadMsg && (
                  <div style={{
                    fontSize: 13, marginTop: 16, padding: '12px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: uploadMsg.type === 'success' ? '#d1fae5' : uploadMsg.type === 'warning' ? '#fef3c7' : '#fee2e2',
                    color: uploadMsg.type === 'success' ? '#065f46' : uploadMsg.type === 'warning' ? '#78350f' : '#7f1d1d',
                  }}>
                    {uploadMsg.type === 'success' && <CheckCircle size={16} />}
                    {uploadMsg.type === 'warning' && <Info size={16} />}
                    {uploadMsg.type === 'error' && <AlertCircle size={16} />}
                    {uploadMsg.text}
                  </div>
                )}
                {!players.length && !uploadMsg && (
                  <div style={{ fontSize: 12, color: '#71717a', marginTop: 12 }}>
                    Not sure what to export? Check the <strong style={{ color: '#a78bfa' }}>Setup Guide</strong> tab above.
                  </div>
                )}
              </div>

              {players.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: '#a1a1aa' }}>
                      Showing <strong style={{ color: '#e4e4e7' }}>{filtered.length}</strong> {posFilter === 'All' ? 'players' : posFilter + 's'}
                      {searchTerm && <span style={{ color: '#a78bfa' }}>{' matching "'}{searchTerm}{'"'}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {VIEW_MODES.map(m => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                          background: viewMode === m ? 'rgba(124,58,237,0.15)' : 'transparent',
                          border: '0.5px solid ' + (viewMode === m ? '#7c3aed' : 'rgba(139,92,246,0.25)'), borderRadius: 8, padding: '6px 12px',
                          cursor: 'pointer', color: viewMode === m ? '#8b5cf6' : '#71717a', fontSize: 13, fontWeight: viewMode === m ? 600 : 400,
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
                                  <th key={h.id} onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                                    style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#8b5cf6', cursor: h.column.getCanSort() ? 'pointer' : 'default', userSelect: 'none', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      {flexRender(h.column.columnDef.header, h.getContext())}
                                      {h.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                                      {h.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            ))}
                          </thead>
                          <tbody>
                            {table.getRowModel().rows.map(row => (
                              <tr key={row.id} style={{ borderBottom: '0.5px solid rgba(139,92,246,0.1)' }}
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
                        <div key={p.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedPlayer(p); setActiveTab('data-hub'); }}>
                          <PlayerCard player={p} onRemove={shortlist.find(s => s.id === p.id) ? () => removeFromShortlist(p.id) : undefined} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'data-hub' && (
            <div>
              {players.length === 0 ? (
                <EmptyState icon={<Zap />} title="No data yet" body="Upload a CSV to access the Data Hub." />
              ) : !selectedPlayer ? (
                <EmptyState icon={<Eye />} title="Select a player" body='Click "Hub" next to any player in the Upload tab to see their full breakdown.' />
              ) : (
                <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selectedPlayer.name}</h2>
                      <p style={{ fontSize: 13, color: '#a1a1aa' }}>{selectedPlayer.position} · {selectedPlayer.league} · Age {selectedPlayer.age}</p>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selectedPlayer.badge.icon && <Tag variant="info">{selectedPlayer.badge.icon} {selectedPlayer.badge.label}</Tag>}
                        {selectedPlayer.valueEstimated && <Tag variant="warning">⚠️ Value estimated</Tag>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'monospace', color: scoreColor(selectedPlayer.valueScore), lineHeight: 1 }}>{selectedPlayer.valueScore}</div>
                      <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, fontWeight: 600 }}>Value Score</div>
                      {selectedPlayerScorePercentile !== null && (
                        <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>Top {100 - selectedPlayerScorePercentile}% of this dataset</div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Score Breakdown</div>
                    <StatBar label="Performance (P/90 stats)" value={selectedPlayer.perfPercent} color="#10b981" />
                    <StatBar label="Value for money" value={selectedPlayer.valuePercent} color="#8b5cf6" />
                    <StatBar label="Age factor" value={selectedPlayer.agePercent} color="#a78bfa" />
                  </div>

                  {/* ADVANCED: Radar (star) chart + Scatter (dot) chart side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: getStatsForPosition(selectedPlayer.position as PlayerPosition, selectedPlayer.p90Stats).length >= 3 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 24 }}>
                    {getStatsForPosition(selectedPlayer.position as PlayerPosition, selectedPlayer.p90Stats).length >= 3 && (
                      <div style={{ background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 4, textAlign: 'center' }}>Performance Shape</div>
                        <div style={{ fontSize: 10, color: '#52525b', marginBottom: 8, textAlign: 'center' }}>
                          <span style={{ color: '#10b981' }}>●</span> Player &nbsp;
                          <span style={{ color: '#8b5cf6' }}>- - -</span> Benchmark
                        </div>
                        <RadarChart statsList={getStatsForPosition(selectedPlayer.position as PlayerPosition, selectedPlayer.p90Stats)} size={220} />
                      </div>
                    )}
                    {players.filter(p => p.position === selectedPlayer.position).length >= 2 && (
                      <div style={{ background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 4, textAlign: 'center' }}>
                          vs. Other {selectedPlayer.position}s In This Dataset
                        </div>
                        <div style={{ fontSize: 10, color: '#52525b', marginBottom: 8, textAlign: 'center' }}>
                          <span style={{ color: '#10b981' }}>●</span> This player &nbsp;
                          <span style={{ color: '#8b5cf6' }}>●</span> Peers
                        </div>
                        <PositionScatterChart players={players} position={selectedPlayer.position as PlayerPosition} selectedId={selectedPlayer.id} width={280} height={190} />
                      </div>
                    )}
                  </div>

                  {/* ADVANCED: Auto-generated strengths / weaknesses vs same-position peers */}
                  {(() => {
                    const { strengths, weaknesses } = generateInsights(selectedPlayer, players);
                    if (!strengths.length && !weaknesses.length) return null;
                    return (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Scouting Notes</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {strengths.map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                              <span style={{ color: '#10b981', fontWeight: 700 }}>▲</span>
                              <span style={{ color: '#a1a1aa' }}>
                                <strong style={{ color: '#e4e4e7' }}>{s.label}</strong> is a strength — {s.percentile}th percentile among {selectedPlayer.position}s here
                              </span>
                            </div>
                          ))}
                          {weaknesses.map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                              <span style={{ color: '#ef4444', fontWeight: 700 }}>▼</span>
                              <span style={{ color: '#a1a1aa' }}>
                                <strong style={{ color: '#e4e4e7' }}>{s.label}</strong> lags behind — only {s.percentile}th percentile among {selectedPlayer.position}s here
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', marginBottom: 6 }}>Transfer Value</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {selectedPlayer.transferValueDisplay}
                        {selectedPlayer.valueEstimated && <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 6 }}>(estimated)</span>}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', marginBottom: 6 }}>Weekly Wage</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedPlayer.wageDisplay}</div>
                    </div>
                  </div>

                  <P90StatsGrid player={selectedPlayer} />

                  {/* ADVANCED: Similar players — same position, closest value score */}
                  {(() => {
                    const similar = getSimilarPlayers(selectedPlayer, players);
                    if (!similar.length) return null;
                    return (
                      <div style={{ marginTop: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Similar Players (Same Position)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {similar.map(p => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPlayer(p)}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.15)',
                                borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                                width: '100%', color: 'inherit',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: '#71717a' }}>{p.age}y · {p.league} · {p.transferValueDisplay}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: scoreColor(p.valueScore) }}>{p.valueScore}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 12, color: p.p90Stats.moneyballIndex > 0.7 ? '#10b981' : '#f59e0b' }}>🎯 {p.p90Stats.moneyballIndex.toFixed(2)}</span>
                                <ChevronRight size={14} color="#71717a" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button onClick={() => addToShortlist(selectedPlayer)} style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: 'white', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Star size={14} /> Add to shortlist
                    </button>
                    <button onClick={() => copyName(selectedPlayer)} style={{ padding: '12px 16px', borderRadius: 8, border: '0.5px solid rgba(139,92,246,0.3)', background: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Copy size={14} />{copiedId === selectedPlayer.id ? 'Copied!' : 'Copy name'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'squad' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>Formation:</span>
                {Object.keys(FORMATION_SLOTS).map(f => (
                  <button key={f} onClick={() => { setFormation(f); setSquad(Array(FORMATION_SLOTS[f].length).fill(null)); }} style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: formation === f ? '#7c3aed' : 'rgba(24,18,43,0.8)', color: formation === f ? 'white' : '#a1a1aa',
                    border: formation === f ? 'none' : '0.5px solid rgba(139,92,246,0.25)',
                  }}>{f}</button>
                ))}
                <button onClick={() => setSquad(Array(slots.length).fill(null))} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: '0.5px solid rgba(239,68,68,0.4)', color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Trash2 size={13} /> Clear
                </button>
              </div>

              {squad.some(Boolean) && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Avg score', value: squadStats.avgScore, color: scoreColor(squadStats.avgScore) },
                    { label: 'Avg age', value: squadStats.avgAge, color: '#a1a1aa' },
                    { label: 'Moneyball', value: squadStats.moneyball, color: squadStats.moneyball > 0.6 ? '#10b981' : '#f59e0b' },
                    { label: 'Top tier', value: `${squadStats.gems} 💎`, color: '#a78bfa' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: 1, background: 'rgba(24,18,43,0.7)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1, background: 'rgba(5,46,22,0.2)', border: '0.5px solid rgba(34,197,94,0.15)', borderRadius: 16, padding: 20, minHeight: 500 }}>
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
                          }}>
                          <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{slot.label}</div>
                          {assigned ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, marginBottom: 3 }}>{assigned.name.split(' ').slice(-1)[0]}</div>
                              <div style={{ fontSize: 12, color: scoreColor(assigned.valueScore), fontWeight: 700, marginBottom: 4 }}>{assigned.valueScore}</div>
                              <button onClick={() => { const s = [...squad]; s[i] = null; setSquad(s); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0 }}><X size={12} /></button>
                            </>
                          ) : <div style={{ fontSize: 11, color: '#52525b', opacity: 0.6 }}>Drop {slot.position}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shortlist ({shortlist.length})</div>
                  {shortlist.length === 0 && <EmptyState icon={<Star />} title="Empty" body="Add from Upload tab." />}
                  {shortlist.map(p => (
                    <div key={p.id} draggable onDragStart={e => e.dataTransfer.setData('playerId', p.id.toString())}
                      style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '10px', marginBottom: 8, cursor: 'grab', userSelect: 'none' }}>
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

          {activeTab === 'compare' && (
            <div>
              {players.length === 0 ? <EmptyState icon={<BarChart3 />} title="No data" body="Upload a CSV first." /> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    {[compareA, compareB].map((sel, idx) => (
                      <div key={idx}>
                        <div style={{ fontSize: 12, color: '#8b5cf6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Player {idx + 1}</div>
                        <select value={sel?.id ?? ''} onChange={e => {
                          const p = players.find(pl => pl.id === parseInt(e.target.value)) ?? null;
                          if (idx === 0) setCompareA(p);
                          else setCompareB(p);
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
                        ].map(({ label, a, b, max }) => (
                          <div key={label} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                              <span style={{ color: scoreColor(a), fontWeight: 700 }}>{a > 10 ? Math.round(a) : a.toFixed(2)}</span>
                              <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{label}</span>
                              <span style={{ color: scoreColor(b), fontWeight: 700 }}>{b > 10 ? Math.round(b) : b.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', direction: 'rtl' }}>
                                <div style={{ height: '100%', width: `${Math.min((a / max) * 100, 100)}%`, background: scoreColor(a), borderRadius: 99 }} />
                              </div>
                              <div style={{ width: 2, height: 6, background: 'rgba(139,92,246,0.4)' }} />
                              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min((b / max) * 100, 100)}%`, background: scoreColor(b), borderRadius: 99 }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'setup' && (
            <div style={{ maxWidth: 760 }}>
              <div style={{ background: 'rgba(124,58,237,0.08)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={16} style={{ color: '#8b5cf6' }} /> Before you start
                </div>
                <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.7 }}>
                  FM26 doesn&apos;t have a native CSV export — you need the <strong style={{ color: '#c4b5fd' }}>Player Export tool</strong> to
                  get your squad/league data out. Set up the columns below for your position, export, and drop the file
                  straight into the Upload tab. This app auto-detects whatever format the tool gives you
                  {'(semicolons or commas, currency ranges, "Unknown" values — all handled automatically).'}
                </p>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Column Checklist By Position
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginBottom: 14 }}>
                Download a template for your position — it&apos;s just the header row, so you can open it in Notepad
                to see exactly which columns to set up in the export tool.
              </div>

              {Object.entries(SETUP_COLUMNS).map(([position, cols], i) => (
                <Accordion key={position} title={position} icon={<Target size={14} style={{ color: '#8b5cf6' }} />} defaultOpen={i === 0}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 12 }}>
                    {cols.map(c => <Tag key={c}>{c}</Tag>)}
                  </div>
                  <button
                    onClick={() => downloadTemplate(position, cols)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      background: 'rgba(124,58,237,0.15)', border: '0.5px solid rgba(139,92,246,0.4)',
                      borderRadius: 8, color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Download size={13} /> Download {position} template (.csv)
                  </button>
                </Accordion>
              ))}

              <button
                onClick={() => {
                  Object.entries(SETUP_COLUMNS).forEach(([position, cols], i) => {
                    setTimeout(() => downloadTemplate(position, cols), i * 150);
                  });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginTop: 4, marginBottom: 8,
                  background: '#7c3aed', border: 'none', borderRadius: 8, color: 'white',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Download size={14} /> Download all {Object.keys(SETUP_COLUMNS).length} position templates
              </button>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', margin: '24px 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Common Issues
              </div>

              <Accordion title="CSV won't upload" icon={<AlertCircle size={14} style={{ color: '#ef4444' }} />}>
                <ul style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.8, paddingLeft: 18 }}>
                  <li>Make sure the file is .csv</li>
                  <li>Make sure it has a Name/Player column with actual player names</li>
                  <li>The app handles both comma and semicolon-separated files automatically</li>
                </ul>
              </Accordion>

              <Accordion title="Scores all look low / the same" icon={<AlertCircle size={14} style={{ color: '#f59e0b' }} />}>
                <ul style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.8, paddingLeft: 18 }}>
                  <li>Check you included the position-specific stat columns above (Goals for strikers, Tackles for defenders, etc.)</li>
                  <li>Players with under 500 minutes get a reliability penalty — that&apos;s intentional</li>
                  <li>{'If Transfer Value shows "Unknown" or "Not for Sale," the app uses a conservative estimate and flags it with a ~ symbol'}</li>
                </ul>
              </Accordion>

              <Accordion title="Do I need to calculate P/90 stats myself?" icon={<Info size={14} style={{ color: '#8b5cf6' }} />}>
                <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.7 }}>
                  No. Export raw season totals (Goals, Tackles, Assists, Minutes). The app converts everything to
                  per-90 automatically in the Data Hub. If your export tool already gives a per-90 column
                  (like Cln/90), the app detects that too and won&apos;t double-convert it.
                </p>
              </Accordion>
            </div>
          )}

          {activeTab === 'guide' && (
            <div style={{ maxWidth: 720 }}>
              {[
                { icon: <Settings size={18} />, title: 'Step 1: Export your data', body: 'Use the Player Export tool with the columns listed in the Setup Guide tab for your position.' },
                { icon: <Upload size={18} />, title: 'Step 2: Upload', body: 'Drag the CSV into the Upload tab. Any format the export tool produces is handled automatically.' },
                { icon: <Zap size={18} />, title: 'Step 3: Data Hub', body: 'Click Hub on any player to view detailed P/90 stats, benchmarks, and moneyball metrics.' },
                { icon: <Target size={18} />, title: 'Understanding Moneyball', body: 'Score > 0.8 = elite value. 0.6-0.8 = good value. < 0.6 = investigate further.' },
                { icon: <Users size={18} />, title: 'Squad Builder', body: 'Drag players from shortlist into your formation. View squad-wide stats.' },
                { icon: <BarChart3 size={18} />, title: 'Compare Players', body: 'Side-by-side breakdown of any two players.' },
              ].map(({ icon, title, body }, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 18, background: 'rgba(24,18,43,0.6)', border: '0.5px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#8b5cf6' }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {shortlist.length > 0 && (
          <aside style={{ width: 280, flexShrink: 0 }}>
            <div style={{ background: 'rgba(24,18,43,0.8)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 16, padding: 16, position: 'sticky', top: 88, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Shortlist ({shortlist.length})</div>
                <button onClick={() => setShortlist([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}><Trash2 size={10} /> Clear</button>
              </div>
              {shortlist.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '0.5px solid rgba(139,92,246,0.1)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{p.position} · Age {p.age}</div>
                    <div style={{ fontSize: 10, color: '#52525b', marginTop: 2, display: 'flex', gap: 4 }}>
                      <span style={{ color: scoreColor(p.valueScore), fontWeight: 700 }}>Score {p.valueScore}</span>
                      <span>·</span>
                      <span style={{ color: p.p90Stats.moneyballIndex > 0.7 ? '#10b981' : '#f59e0b' }}>🎯 {p.p90Stats.moneyballIndex.toFixed(2)}</span>
                    </div>
                  </div>
                  <button onClick={() => removeFromShortlist(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', padding: 0 }}><X size={14} /></button>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      <footer style={{ borderTop: '0.5px solid rgba(139,92,246,0.2)', padding: '20px 24px', textAlign: 'center', fontSize: 12, color: '#52525b', marginTop: 40 }}>
        FM Value Scout V7 · P/90 Moneyball · Made for FM26
      </footer>
    </div>
  );
}
