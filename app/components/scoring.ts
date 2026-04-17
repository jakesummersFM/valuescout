// Pure scoring helpers — no React, fully testable

import type { PlayerRawData, Player } from './types';

export const POSITION_FILTERS = [
  { label: 'All',       value: 'All' },
  { label: 'GK',        value: 'GK' },
  { label: 'Wing-Back', value: 'Wing Back' },
  { label: 'CB',        value: 'Central Defender' },
  { label: 'CDM',       value: 'CDM' },
  { label: 'CM',        value: 'Centre Mid' },
  { label: 'AM',        value: 'Attacking Mid' },
  { label: 'Winger',    value: 'Winger' },
  { label: 'ST',        value: 'Striker' },
];

export const RECOMMENDED_COLUMNS: Record<string, string[]> = {
  'Central Defender': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Itc'],
  'CDM':              ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Itc', 'Key', 'Pas %'],
  'Wing Back':        ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Itc', 'Key', 'Ast'],
  'Centre Mid':       ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tck C', 'Key', 'Ast'],
  'Attacking Mid':    ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Gls', 'Ast', 'Key', 'Shots', 'xG'],
  'Winger':           ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Gls', 'Ast', 'Key', 'Shots', 'xG'],
  'Striker':          ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Gls', 'Ast', 'Shots', 'xG'],
  'GK':               ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Sv %', 'Clean Sheets'],
};

export const FORMATION_SLOTS: Record<string, { label: string; position: string }[][]> = {
  '4-3-3': [
    [{ label: 'RW', position: 'Winger' }, { label: 'ST', position: 'Striker' }, { label: 'LW', position: 'Winger' }],
    [{ label: 'CM', position: 'Centre Mid' }, { label: 'CDM', position: 'CDM' }, { label: 'CM', position: 'Centre Mid' }],
    [{ label: 'RB', position: 'Wing Back' }, { label: 'CB', position: 'Central Defender' }, { label: 'CB', position: 'Central Defender' }, { label: 'LB', position: 'Wing Back' }],
    [{ label: 'GK', position: 'GK' }],
  ],
  '4-4-2': [
    [{ label: 'ST', position: 'Striker' }, { label: 'ST', position: 'Striker' }],
    [{ label: 'RM', position: 'Winger' }, { label: 'CM', position: 'Centre Mid' }, { label: 'CM', position: 'Centre Mid' }, { label: 'LM', position: 'Winger' }],
    [{ label: 'RB', position: 'Wing Back' }, { label: 'CB', position: 'Central Defender' }, { label: 'CB', position: 'Central Defender' }, { label: 'LB', position: 'Wing Back' }],
    [{ label: 'GK', position: 'GK' }],
  ],
  '3-5-2': [
    [{ label: 'ST', position: 'Striker' }, { label: 'ST', position: 'Striker' }],
    [{ label: 'RWB', position: 'Wing Back' }, { label: 'CM', position: 'Centre Mid' }, { label: 'CDM', position: 'CDM' }, { label: 'CM', position: 'Centre Mid' }, { label: 'LWB', position: 'Wing Back' }],
    [{ label: 'CB', position: 'Central Defender' }, { label: 'CB', position: 'Central Defender' }, { label: 'CB', position: 'Central Defender' }],
    [{ label: 'GK', position: 'GK' }],
  ],
};

export function getPositionGroup(pos: string): string {
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

export function getLeagueMultiplier(league: string): number {
  const l = (league || '').toLowerCase();
  if (['premier', 'bundesliga', 'la liga', 'serie a', 'ligue 1'].some(s => l.includes(s))) return 1.25;
  if (l.includes('championship') || l.includes('segunda') || l.includes('serie b')) return 1.12;
  return 1.0;
}

export function parseNum(row: PlayerRawData, keys: string[], def = 0): number {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()] ?? row[key.replace(/ /g, '')];
    if (val !== undefined) {
      const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (!isNaN(n)) return n;
    }
  }
  return def;
}

export function scoreColor(s: number) {
  if (s >= 85) return 'var(--vs-score-green)';
  if (s >= 75) return 'var(--vs-score-purple)';
  if (s >= 65) return 'var(--vs-score-amber)';
  return 'var(--vs-score-red)';
}

export function calculateValueScore(
  row: PlayerRawData,
  position: string,
  league: string,
  balanced: boolean
) {
  const minutes = parseNum(row, ['Minutes', 'Mins', 'Min'], 90) || 90;
  const per90 = (s: number) => (minutes > 0 ? s / (minutes / 90) : s);

  const goals         = per90(parseNum(row, ['Goals', 'Gls']));
  const assists       = per90(parseNum(row, ['Assists', 'Ast']));
  const xG            = per90(parseNum(row, ['xG']));
  const keyPasses     = per90(parseNum(row, ['Key Passes', 'KP', 'Key']));
  const shots         = per90(parseNum(row, ['Shots', 'Sh']));
  const tackles       = per90(parseNum(row, ['Tackles', 'Tck C', 'Tck']));
  const interceptions = per90(parseNum(row, ['Interceptions', 'Itc']));
  const savePct       = parseNum(row, ['Sv %', 'Save %']);
  const cleanSheets   = parseNum(row, ['Clean Sheets', 'CS']);

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
  const baseScore  = performance * 2.45;
  const valueM     = Math.max(0.3, parseNum(row, ['Transfer Value'], 0.5));
  const wageK      = Math.max(0.5, parseNum(row, ['Wage'], 1000) / 1000);
  const efficiency = Math.min(45, Math.max(25, 88 / (valueM * 0.45 + wageK * 0.55)));

  const age      = Number(row.Age ?? 25) || 25;
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

export function calculateBadge(score: number, valueM: number, age: number): Player['badge'] {
  if (score >= 88 && (age <= 23 || valueM <= 12)) return { type: 'gem',        label: 'Hidden Gem',  icon: '💎' };
  if (score < 60  && valueM > 25)                 return { type: 'avoid',      label: "Don't Touch", icon: '🚫' };
  if (score >= 82 && valueM > 40)                 return { type: 'overpriced', label: 'Overpriced',  icon: '⚠️' };
  if (score < 72  && valueM < 10)                 return { type: 'overrated',  label: 'Overrated',   icon: '🔥' };
  return { type: 'none', label: '', icon: '' };
}

export function buildPlayer(
  row: PlayerRawData,
  index: number,
  idBase: number,
  balanced: boolean
): Player {
  const rawPos = String(row.Position ?? row.Pos ?? '');
  const group  = getPositionGroup(rawPos);
  const league = String(row.League ?? row.Division ?? '');
  const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league, balanced);
  const valueM = Math.max(0.3, parseNum(row, ['Transfer Value'], 0.5));
  const age    = Number(row.Age ?? 25) || 25;

  return {
    id:   idBase + index,
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
}
