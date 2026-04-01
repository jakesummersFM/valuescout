'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, Download, Plus, Trash2, Users, X, Eye, BarChart3, Heart, Info } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, SortingState, flexRender } from '@tanstack/react-table';

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
  rawData: any;
  badge: { type: 'gem' | 'overpriced' | 'overrated' | 'avoid' | 'none'; label: string; icon: string };
  perfPercent: number;
  valuePercent: number;
  agePercent: number;
}

const positionFilters = [
  { label: 'All Positions', value: 'All' },
  { label: 'Goalkeeper', value: 'GK' },
  { label: 'Wing-Back', value: 'Wing Back' },
  { label: 'Central Defender', value: 'Central Defender' },
  { label: 'Centre Mid', value: 'Centre Mid' },
  { label: 'Attacking Mid', value: 'Attacking Mid' },
  { label: 'Winger', value: 'Winger' },
  { label: 'Striker', value: 'Striker' },
];

export default function FMValueScoutV2() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const getPositionGroup = (pos: string): string => {
    const p = (pos || '').toLowerCase();
    if (p.includes('gk')) return 'GK';
    if (p.includes('wing back') || p.includes('wb') || p.includes('full back')) return 'Wing Back';
    if (p.includes('dc') || p.includes('central defender') || p.includes('cb')) return 'Central Defender';
    if (p.includes('dm') || p.includes('defensive mid') || p.includes('cm')) return 'Centre Mid';
    if (p.includes('am')) return 'Attacking Mid';
    if (p.includes('winger') || p.includes('mr') || p.includes('ml') || p.includes('rw') || p.includes('lw')) return 'Winger';
    if (p.includes('st') || p.includes('striker') || p.includes('cf')) return 'Striker';
    return 'Other';
  };

  const getLeagueMultiplier = (league: string): number => {
    const l = (league || '').toLowerCase();
    if (l.includes('premier') || l.includes('bundesliga') || l.includes('la liga') || l.includes('serie a') || l.includes('ligue 1')) return 1.25;
    if (l.includes('championship') || l.includes('2. bundesliga') || l.includes('ligue 2')) return 1.12;
    if (l.includes('league one') || l.includes('league two')) return 1.0;
    return 0.95;
  };

  const calculateValueScore = (row: any, position: string, league: string): { score: number; perfPercent: number; valuePercent: number; agePercent: number } => {
    const getNum = (keys: string[], def = 0) => {
      for (const key of keys) {
        let val = row[key] || row[key.toLowerCase()] || row[key.replace(/ /g, '')];
        if (val !== undefined) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) return num;
        }
      }
      return def;
    };

    const minutes = getNum(['Minutes', 'Mins', 'Min', '90s']) || 90;
    const per90 = (stat: number) => (minutes > 0 ? stat / (minutes / 90) : stat);

    const tackles = per90(getNum(['Tackles', 'Tck C', 'Tkl']));
    const interceptions = per90(getNum(['Interceptions', 'Itc']));
    const goals = per90(getNum(['Goals', 'Gls']));
    const assists = per90(getNum(['Assists', 'Ast']));
    const xG = per90(getNum(['xG']));
    const keyPasses = per90(getNum(['Key Passes', 'KP']));
    const savePct = getNum(['Save %']);
    const shots = per90(getNum(['Shots']));

    let performance = 0;

    switch (position) {
      case 'GK':
        performance = savePct * 3.0;
        break;
      case 'Wing Back':
        performance = (tackles * 2.9) + (keyPasses * 2.1) + (assists * 1.8);
        break;
      case 'Central Defender':
        performance = (tackles * 3.6) + (interceptions * 3.3);   // Tuned for thin defender data
        break;
      case 'Centre Mid':
        performance = (tackles * 2.7) + (keyPasses * 2.5) + (assists * 2.1);
        break;
      case 'Attacking Mid':
        performance = (assists * 2.9) + (keyPasses * 2.7) + (goals * 2.1) + (shots * 0.65);
        break;
      case 'Winger':
        performance = (assists * 2.7) + (keyPasses * 2.4) + (goals * 2.3) + (shots * 0.75);
        break;
      case 'Striker':
        performance = (goals * 4.1) + (assists * 2.3) + (xG > 0 ? (goals / xG) * 55 : goals * 42) + (shots * 0.85);
        break;
      default:
        performance = (tackles + interceptions + goals + assists) * 2.6;
    }

    const leagueMultiplier = getLeagueMultiplier(league);
    let baseScore = performance * 2.75;   // Increased scaling for better spread on thin data

    const valueStr = String(row['Transfer Value'] || row.Value || '0').replace(/[^0-9.-]/g, '');
    const valueM = Math.max(0.05, parseFloat(valueStr) || 0.5);
    const wageK = Math.max(0.5, (getNum(['Wage', 'Weekly Wage']) || 1000) / 1000);

    const efficiency = Math.min(45, Math.max(20, 88 / (valueM * 0.42 + wageK * 0.58)));

    const age = parseInt(row.Age) || 25;
    const ageBonus = age <= 21 ? 23 : age <= 23 ? 16 : age <= 26 ? 9 : age >= 33 ? -10 : 0;

    let finalScore = (baseScore * 0.54) + (efficiency * 0.34) + ageBonus;
    finalScore *= leagueMultiplier;

    const score = Math.max(48, Math.min(99, Math.round(finalScore)));

    const perfPercent = Math.round(Math.min(100, (baseScore * 0.54 / Math.max(finalScore, 1)) * 100)) || 68;
    const valuePercent = Math.round(Math.min(100, (efficiency * 0.34 / Math.max(finalScore, 1)) * 100)) || 62;
    const agePercent = Math.round(Math.min(100, (ageBonus / Math.max(finalScore, 1)) * 100)) || 45;

    return { score, perfPercent, valuePercent, agePercent };
  };

  const calculateBadge = (score: number, valueM: number, age: number): Player['badge'] => {
    if (score >= 88 && (age <= 23 || valueM <= 12)) return { type: 'gem', label: 'Hidden Gem', icon: '💎' };
    if (score < 60 && valueM > 25) return { type: 'avoid', label: "Don't Touch", icon: '🚫' };
    if (score >= 82 && valueM > 40) return { type: 'overpriced', label: 'Overpriced', icon: '⚠️' };
    if (score < 72 && valueM < 10) return { type: 'overrated', label: 'Overrated', icon: '🔥' };
    return { type: 'none', label: '', icon: '' };
  };

  const parseAndProcessCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setUploadMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setUploadMessage({ type: 'error', text: 'CSV is empty' });
          setIsProcessing(false);
          return;
        }

        const parsedPlayers: Player[] = results.data
          .map((row: any, index: number) => {
            const rawPos = row.Position || row.Pos || 'Other';
            const group = getPositionGroup(rawPos);
            const league = row.League || row.Division || row.Competition || '';
            const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league);
            const valueM = Math.max(0.05, parseFloat(String(row['Transfer Value'] || row.Value || '0').replace(/[^0-9.-]/g, '')) || 0.5);
            const age = parseInt(row.Age) || 25;
            const badge = calculateBadge(score, valueM, age);

            return {
              id: Date.now() + index,
              rank: index + 1,
              name: row.Name || row.Player || 'Unknown Player',
              nationality: row.Nationality || row.Nat || '🌍',
              age,
              position: group,
              league,
              valueScore: score,
              keyStat: group === 'Central Defender' || group === 'Wing Back' 
                ? `Tck: ${row['Tck C'] || row.Tackles || '-'} | Itc: ${row['Itc'] || row.Interceptions || '-'}` 
                : group === 'Striker' ? `xG: ${row['xG'] || '-'} | Shots: ${row['Shots'] || '-'}` 
                : `Key: ${row['Tck C'] || row.Tackles || '-'}`,
              transferValue: row['Transfer Value'] || row.Value || '€0',
              wage: row.Wage || row['Weekly Wage'] || '€0',
              rawData: row,
              badge,
              perfPercent,
              valuePercent,
              agePercent,
            };
          })
          .sort((a, b) => b.valueScore - a.valueScore)
          .map((p, i) => ({ ...p, rank: i + 1 }));

        setPlayers(parsedPlayers);
        setUploadMessage({ 
          type: 'success', 
          text: `Loaded ${parsedPlayers.length} players! Optimized for thin/early-season defender data.` 
        });
        setIsProcessing(false);
      },
      error: () => {
        setUploadMessage({ type: 'error', text: 'Failed to parse CSV' });
        setIsProcessing(false);
      }
    });
  }, []);

  // ... (handleFileUpload, filteredPlayers, columns, table, addToShortlist, removeFromShortlist, exportShortlist, and the full JSX remain exactly the same as the previous full code I sent)

  // For brevity, paste the entire previous component and only replace the calculateValueScore + calculateBadge + the upload area note below.

