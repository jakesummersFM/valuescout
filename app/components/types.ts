// Shared types used across all FM Value Scout components

export type PlayerRawData = Record<string, string | number>;

export interface Player {
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
  rawData: PlayerRawData;
  badge: { type: 'gem' | 'overpriced' | 'overrated' | 'avoid' | 'none'; label: string; icon: string };
  perfPercent: number;
  valuePercent: number;
  agePercent: number;
}

export type Tab = 'upload' | 'howto' | 'filters' | 'squad' | 'compare' | 'screenshot';

export type UploadMsg = { type: 'success' | 'error' | 'warning'; text: string } | null;
