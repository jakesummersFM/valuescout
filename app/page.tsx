'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import Tesseract from 'tesseract.js';
import { Upload, Download, X, Heart, FileText, Tv, MessageCircle, Users, HelpCircle, Copy, Image as ImageIcon, AlertTriangle, Trash2 } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, SortingState, flexRender } from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function FMValueScoutV5() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'howto' | 'filters' | 'squad' | 'screenshot'>('upload');
  const [balancedMode, setBalancedMode] = useState(false);
  const [screenshotProcessing, setScreenshotProcessing] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [formation, setFormation] = useState('4-3-3');

  const positionFilters = [
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

  const recommendedColumns = {
    'All': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes'],
    'GK': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Save %', 'Clean Sheets'],
    'Central Defender': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions'],
    'CDM': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions', 'Key Passes'],
    'Wing Back': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions', 'Assists'],
    'Centre Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Key Passes', 'Assists'],
    'Attacking Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Key Passes', 'xG'],
    'Winger': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Key Passes', 'xG'],
    'Striker': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Shots', 'xG'],
  };

  const getPositionGroup = (pos: string): string => {
    const p = (pos || '').toLowerCase();
    if (p.includes('gk')) return 'GK';
    if (p.includes('wing back') || p.includes('wb')) return 'Wing Back';
    if (p.includes('d (c)') || p.includes('cb')) return 'Central Defender';
    if (p.includes('dm')) return 'CDM';
    if (p.includes('cm')) return 'Centre Mid';
    if (p.includes('am')) return 'Attacking Mid';
    if (p.includes('winger') || p.includes('rw') || p.includes('lw')) return 'Winger';
    if (p.includes('st') || p.includes('cf')) return 'Striker';
    return 'Central Defender';
  };

  const calculateValueScore = (row: any, position: string) => {
    const getNum = (keys: string[], def = 0) => {
      for (const key of keys) {
        const val = row[key] || row[key.toLowerCase()] || row[key.replace(/ /g, '')];
        if (val !== undefined) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) return num;
        }
      }
      return def;
    };

    const minutes = getNum(['Minutes', 'Mins'], 1800);
    const per90 = (stat: number) => minutes > 0 ? stat / (minutes / 90) : stat;

    const goals = per90(getNum(['Goals']));
    const assists = per90(getNum(['Assists']));
    const xG = per90(getNum(['xG']));
    const keyPasses = per90(getNum(['Key Passes', 'KP']));
    const shots = per90(getNum(['Shots']));
    const tackles = per90(getNum(['Tackles', 'Tck']));
    const interceptions = per90(getNum(['Interceptions', 'Itc']));
    const savePct = getNum(['Save %', 'Sv %']);

    let performance = 0;
    if (position === 'GK') performance = savePct * 1.85;
    else if (['Central Defender', 'CDM', 'Wing Back'].includes(position)) {
      performance = (tackles * 4.2) + (interceptions * 4.0) + (keyPasses * 1.5) + (minutes / 120);
    } else {
      performance = (goals * 3.8) + (assists * 2.4) + (xG > 0 ? (goals / xG) * 45 : goals * 35) + (shots * 0.9) + (keyPasses * 1.8);
    }

    const baseScore = performance * 2.45;
    const valueM = 8;
    const wageK = 6;
    const efficiency = Math.min(45, Math.max(25, 88 / (valueM * 0.45 + wageK * 0.55)));

    const age = parseInt(row.Age) || 22;
    const ageBonus = age <= 21 ? 14 : age <= 23 ? 10 : age <= 26 ? 6 : age >= 32 ? -10 : 0;

    let finalScore = (baseScore * 0.55) + (efficiency * 0.33) + ageBonus;
    if (balancedMode) finalScore *= 0.92;

    const score = Math.max(48, Math.min(97, Math.round(finalScore)));

    const perfPercent = Math.round(Math.min(100, (baseScore * 0.55 / Math.max(finalScore, 1)) * 100)) || 65;
    const valuePercent = Math.round(Math.min(100, (efficiency * 0.33 / Math.max(finalScore, 1)) * 100)) || 60;
    const agePercent = Math.round(Math.min(100, (ageBonus / Math.max(finalScore, 1)) * 100)) || 45;

    return { score, perfPercent, valuePercent, agePercent };
  };

  const calculateBadge = (score: number, age: number) => {
    if (score >= 85 && age <= 23) return { type: 'gem' as const, label: 'Hidden Gem', icon: '💎' };
    if (score < 55) return { type: 'avoid' as const, label: "Don't Touch", icon: '🚫' };
    return { type: 'none' as const, label: '', icon: '' };
  };

  const handleScreenshotUpload = async (files: FileList) => {
    setScreenshotProcessing(true);
    setUploadMessage({ type: 'warning', text: 'Processing screenshots with OCR... (may take 15-40 seconds per image)' });

    let allParsedPlayers: Player[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const { data: { text } } = await Tesseract.recognize(files[i], 'eng');

        const lines = text.split('\n').filter(l => l.trim().length > 8);

        lines.forEach((line, idx) => {
          const nameMatch = line.match(/([A-Z][a-zA-Z\s'-]{5,45})/);
          const ageMatch = line.match(/\b(1[6-9]|[2-3][0-9])\b/);
          const posMatch = line.match(/\b(GK|ST|CM|CDM|CB|WB|AM|Winger|D \(C\)|M \(C\)|DM|RW|LW|CF)\b/i);

          if (nameMatch) {
            const name = nameMatch[0].trim();
            const age = ageMatch ? parseInt(ageMatch[1]) : 22;
            const positionText = posMatch ? posMatch[0] : 'Unknown';
            const group = getPositionGroup(positionText);

            const fakeRow = { Name: name, Age: age.toString(), Position: positionText };

            const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(fakeRow, group);
            const badge = calculateBadge(score, age);

            allParsedPlayers.push({
              id: Date.now() + i*10000 + idx,
              rank: allParsedPlayers.length + 1,
              name,
              nationality: '🌍',
              age,
              position: group,
              league: 'Unknown League',
              valueScore: score,
              keyStat: 'OCR Extracted',
              transferValue: '£800K',
              wage: '£6K p/w',
              rawData: fakeRow,
              badge,
              perfPercent,
              valuePercent,
              agePercent,
            });
          }
        });
      } catch (e) {}
    }

    if (allParsedPlayers.length > 0) {
      setPlayers(allParsedPlayers);
      setUploadMessage({ type: 'success', text: `✅ Processed ${allParsedPlayers.length} players (OCR experimental - scores approximate)` });
    } else {
      setUploadMessage({ type: 'error', text: 'No players detected. Try clearer screenshots.' });
    }
    setScreenshotProcessing(false);
  };

  const filteredPlayers = useMemo(() => selectedPositionFilter === 'All' ? players : players.filter(p => p.position === selectedPositionFilter), [players, selectedPositionFilter]);

  const table = useReactTable({
    data: filteredPlayers,
    columns: [
      { accessorKey: 'rank', header: 'Rank' },
      { accessorKey: 'name', header: 'Player' },
      { accessorKey: 'position', header: 'Position' },
      { accessorKey: 'age', header: 'Age' },
      { accessorKey: 'league', header: 'League' },
      { accessorKey: 'keyStat', header: 'Key Stat' },
      { accessorKey: 'valueScore', header: 'Value Score', cell: ({row}) => <div className="font-mono font-bold text-emerald-400 text-xl">{row.original.valueScore}</div> },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({row}) => {
          const p = row.original;
          return (
            <div className="flex gap-2">
              <button onClick={() => setSelectedPlayer(p)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm">View</button>
              <button onClick={() => {navigator.clipboard.writeText(p.name); setCopiedName(p.name); setTimeout(() => setCopiedName(null), 1500);}} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm flex items-center gap-1">
                <Copy className="w-4 h-4" /> {copiedName === p.name ? 'Copied!' : 'Copy'}
              </button>
            </div>
          );
        }
      }
    ],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-zinc-100">
      <nav className="border-b border-violet-900/50 bg-[#0F0A1F]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl font-bold">VS</div>
            <div className="text-3xl font-bold">FM Value Scout <span className="text-xs text-violet-400">V5 Full</span></div>
          </div>
          <a href="https://ko-fi.com/jakesummersfm" target="_blank" className="flex items-center gap-2 text-sm hover:text-red-400">
            <Heart className="w-4 h-4" /> Support
          </a>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex border-b border-violet-900/50 mb-8 overflow-x-auto">
          {['upload', 'howto', 'filters', 'squad', 'screenshot'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`px-8 py-4 font-medium whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
              {tab === 'upload' && 'Upload CSV'}
              {tab === 'howto' && 'How to Use'}
              {tab === 'filters' && 'Export Filters'}
              {tab === 'squad' && 'Squad Builder'}
              {tab === 'screenshot' && 'Screenshot Upload (No Mod)'}
            </button>
          ))}
        </div>

        {/* Screenshot Tab with Warning */}
        {activeTab === 'screenshot' && (
          <div>
            <div className="bg-amber-950 border border-amber-700 rounded-2xl p-6 mb-8 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-400 mt-1 flex-shrink-0" />
              <div className="text-sm text-amber-300">
                <strong>OCR Screenshot Upload is experimental.</strong> It works best with very clear screenshots of player lists. 
                Scores and stats will be approximate. For accurate results, use the BepInEx Player Export mod + CSV upload.
              </div>
            </div>

            <div className="bg-zinc-900/80 border-2 border-dashed border-violet-700 rounded-3xl p-16 text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-6 text-violet-400" />
              <h2 className="text-2xl font-semibold mb-3">Upload Screenshots of Player Lists</h2>
              <p className="text-zinc-400 mb-8">Take clear screenshots of FM26 player lists or individual players.</p>
              <label className="bg-violet-600 hover:bg-violet-500 px-10 py-4 rounded-2xl font-semibold cursor-pointer inline-block">
                Choose Screenshots
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleScreenshotUpload(e.target.files)} />
              </label>
              {screenshotProcessing && <p className="mt-8 text-amber-400">Processing with OCR... please wait</p>}
              {uploadMessage && <p className={`mt-8 ${uploadMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{uploadMessage.text}</p>}
            </div>
          </div>
        )}

        {/* Main Results Table */}
        {players.length > 0 && (
          <div className="mt-10 bg-zinc-900/80 border border-violet-900/50 rounded-3xl overflow-hidden">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="border-b border-violet-900/50 bg-zinc-950">
                    {hg.headers.map(header => (
                      <th key={header.id} className="px-8 py-5 text-left text-sm font-medium text-zinc-400">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-violet-900/30 hover:bg-violet-950/30">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-8 py-6">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {players.length === 0 && (
          <div className="text-center py-20 text-zinc-500">
            Upload CSV or screenshots to begin
          </div>
        )}
      </div>

      {/* Player Modal with three colored bars */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-violet-900/50 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-auto">
            <div className="p-8 border-b border-violet-900/50 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold">{selectedPlayer.name}</h2>
                <p className="text-emerald-400">{selectedPlayer.position} • Age {selectedPlayer.age}</p>
              </div>
              <button onClick={() => setSelectedPlayer(null)}><X className="w-8 h-8" /></button>
            </div>

            <div className="p-8">
              <div className="text-center mb-10">
                <div className="text-8xl font-bold text-emerald-400">{selectedPlayer.valueScore}</div>
                <div className="text-xl text-zinc-400">Value Score</div>
                {selectedPlayer.badge.icon && <div className="mt-6 text-5xl">{selectedPlayer.badge.icon} {selectedPlayer.badge.label}</div>}
              </div>

              <div className="space-y-8 mb-12">
                <div>
                  <div className="flex justify-between mb-2 text-sm"><span>Performance (Stats)</span><span className="font-mono text-emerald-400">{selectedPlayer.perfPercent}%</span></div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${selectedPlayer.perfPercent}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between mb-2 text-sm"><span>Value for Money</span><span className="font-mono text-violet-400">{selectedPlayer.valuePercent}%</span></div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${selectedPlayer.valuePercent}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between mb-2 text-sm"><span>Age Factor</span><span className="font-mono text-purple-400">{selectedPlayer.agePercent}%</span></div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${selectedPlayer.agePercent}%` }} /></div>
                </div>
              </div>

              <h3 className="font-semibold mb-4">All Exported Stats</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {Object.entries(selectedPlayer.rawData).map(([key, value]) => (
                  <div key={key} className="bg-zinc-800 p-4 rounded-2xl">
                    <div className="text-zinc-400 text-xs uppercase">{key}</div>
                    <div className="font-medium mt-1">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 text-center text-xs text-zinc-500 border-t border-violet-900/50">
        FM Value Scout V5 Full • Made with ❤️ for the FM community
      </footer>
    </div>
  );
}