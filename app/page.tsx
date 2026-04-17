'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import Tesseract from 'tesseract.js';
import { X, Heart, Copy, Image as ImageIcon, AlertTriangle, Save } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, SortingState, flexRender } from '@tanstack/react-table';

type PlayerRawData = Record<string, string | number | undefined>;

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
  rawData: PlayerRawData;
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

  // Manual Editor
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlayers, setEditingPlayers] = useState<Player[]>([]);

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

  const calculateValueScore = (row: PlayerRawData, position: string) => {
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

    const age = parseInt(String(row.Age ?? '22'), 10) || 22;
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
    setUploadMessage({ type: 'warning', text: 'Processing screenshots with OCR...' });

    const allParsedPlayers: Player[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const { data: { text } } = await Tesseract.recognize(files[i], 'eng');
        const lines = text.split('\n').filter(l => l.trim().length > 8);

        lines.forEach((line, idx) => {
          const nameMatch = line.match(/([A-Z][a-zA-Z\s'-]{5,50})/);
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
              id: Date.now() + i * 10000 + idx,
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
      } catch {}
    }

    if (allParsedPlayers.length > 0) {
      setEditingPlayers([...allParsedPlayers]);
      setShowEditor(true);
      setUploadMessage({ type: 'success', text: `Detected ${allParsedPlayers.length} players — edit then save` });
    } else {
      setUploadMessage({ type: 'error', text: 'No players detected.' });
    }
    setScreenshotProcessing(false);
  };

  const saveEditedPlayers = () => {
    const scoredPlayers = editingPlayers.map((p, i) => {
      const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(p.rawData, p.position);
      const badge = calculateBadge(score, p.age);
      return { ...p, valueScore: score, perfPercent, valuePercent, agePercent, badge, rank: i + 1 };
    });
    setPlayers(scoredPlayers);
    setShowEditor(false);
    setUploadMessage({ type: 'success', text: `Saved ${scoredPlayers.length} players with scores` });
  };

  const filteredPlayers = useMemo(() => 
    selectedPositionFilter === 'All' ? players : players.filter(p => p.position === selectedPositionFilter),
  [players, selectedPositionFilter]);

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
              <button onClick={() => {navigator.clipboard.writeText(p.name); setCopiedName(p.name); setTimeout(() => setCopiedName(null), 1500);}} 
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm flex items-center gap-1">
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
      {/* Navigation - Fixed Layout */}
      <nav className="border-b border-violet-900/50 bg-[#0F0A1F]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl font-bold">VS</div>
            <div>
              <div className="text-3xl font-bold tracking-tight">FM Value Scout</div>
              <div className="text-xs text-violet-400 -mt-1">V5 Full</div>
            </div>
          </div>
          <a href="https://ko-fi.com/jakesummersfm" target="_blank" className="flex items-center gap-2 text-sm hover:text-red-400 transition">
            <Heart className="w-4 h-4" /> Support
          </a>
        </div>

        {/* Tabs - Clean Horizontal */}
        <div className="border-t border-violet-900/50">
          <div className="max-w-7xl mx-auto px-6 flex">
            {(['upload', 'howto', 'filters', 'squad', 'screenshot'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-medium transition border-b-2 -mb-px ${
                  activeTab === tab 
                    ? 'border-violet-500 text-white' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab === 'upload' && 'Upload CSV'}
                {tab === 'howto' && 'How to Use'}
                {tab === 'filters' && 'Export Filters'}
                {tab === 'squad' && 'Squad Builder'}
                {tab === 'screenshot' && 'Screenshot Upload'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Screenshot Tab */}
        {activeTab === 'screenshot' && (
          <div>
            <div className="bg-amber-950 border border-amber-700 rounded-2xl p-6 mb-10 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-400 mt-1 flex-shrink-0" />
              <div className="text-sm text-amber-300">
                <strong>OCR is experimental.</strong> Use clear screenshots. You can edit data after upload before scoring.
              </div>
            </div>

            <div className="bg-zinc-900/80 border-2 border-dashed border-violet-700 rounded-3xl p-16 text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-6 text-violet-400" />
              <h2 className="text-2xl font-semibold mb-3">Upload Screenshots of Player Lists</h2>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">Take clear screenshots of FM26 player lists or individual players.</p>
              <label className="bg-violet-600 hover:bg-violet-500 px-10 py-4 rounded-2xl font-semibold cursor-pointer inline-block">
                Choose Screenshots
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleScreenshotUpload(e.target.files)} />
              </label>
              {screenshotProcessing && <p className="mt-8 text-amber-400">Processing with OCR...</p>}
              {uploadMessage && <p className={`mt-8 ${uploadMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{uploadMessage.text}</p>}
            </div>
          </div>
        )}

        {/* How to Use Tab */}
        {activeTab === 'howto' && (
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 text-zinc-300">
            <h2 className="text-3xl font-bold mb-8 text-white">How to Use FM Value Scout</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-xl font-semibold text-emerald-400 mb-3">1. Best Way: CSV Export (Recommended)</h3>
                <p className="mb-4">Install the BepInEx Player Export mod in FM26 → select your players → press F9 or Ctrl+P → save the CSV → upload it here.</p>
                <p className="text-sm text-zinc-400">This gives the most accurate and rich data for scoring.</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-amber-400 mb-3">2. No-Mod Alternative: Screenshot Upload</h3>
                <p>Take clear screenshots of player lists in FM26 → upload them → edit any mistakes → click Save & Calculate.</p>
                <p className="text-sm text-amber-400 mt-2">OCR is not perfect — editing helps a lot.</p>
              </div>
            </div>
          </div>
        )}

        {/* Export Filters Tab */}
        {activeTab === 'filters' && (
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10">
            <h2 className="text-3xl font-bold mb-8">Recommended Export Filters per Position</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries({
                'GK': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Save %', 'Clean Sheets'],
                'Central Defender': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions'],
                'CDM': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions', 'Key Passes'],
                'Wing Back': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions', 'Assists'],
                'Striker': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Shots', 'xG'],
              }).map(([pos, cols]) => (
                <div key={pos} className="bg-zinc-800 p-6 rounded-2xl">
                  <h3 className="font-semibold mb-4 text-violet-300">{pos}</h3>
                  <ul className="text-sm text-zinc-400 space-y-1">
                    {cols.map(col => <li key={col}>• {col}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Squad Builder Tab */}
        {activeTab === 'squad' && (
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10">
            <h2 className="text-3xl font-bold mb-6">Squad Builder</h2>
            <div 
              className="bg-zinc-950 border-2 border-dashed border-violet-700 h-96 rounded-3xl flex items-center justify-center text-zinc-400 text-lg"
              onDrop={(e) => { e.preventDefault(); alert('Drag & drop from shortlist coming in next update'); }}
              onDragOver={(e) => e.preventDefault()}
            >
              Drag players from your shortlist onto the pitch (formation view coming soon)
            </div>
            <div className="mt-8 grid grid-cols-4 gap-6 text-center">
              <div className="bg-zinc-800 p-6 rounded-2xl">
                <div className="text-xs text-zinc-400">AVG SCORE</div>
                <div className="text-3xl font-bold text-emerald-400">0.0</div>
              </div>
              <div className="bg-zinc-800 p-6 rounded-2xl">
                <div className="text-xs text-zinc-400">TOTAL WAGE</div>
                <div className="text-3xl font-bold text-violet-400">£0k</div>
              </div>
              <div className="bg-zinc-800 p-6 rounded-2xl">
                <div className="text-xs text-zinc-400">AVG AGE</div>
                <div className="text-3xl font-bold text-purple-400">0.0</div>
              </div>
              <div className="bg-zinc-800 p-6 rounded-2xl">
                <div className="text-xs text-zinc-400">HIDDEN GEMS</div>
                <div className="text-3xl font-bold text-amber-400">0</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Results Table */}
        {players.length > 0 && (
          <div className="mt-12 bg-zinc-900/80 border border-violet-900/50 rounded-3xl overflow-hidden">
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

        {players.length === 0 && activeTab !== 'howto' && activeTab !== 'filters' && activeTab !== 'squad' && (
          <div className="text-center py-24 text-zinc-500">
            Select a tab above to get started
          </div>
        )}
      </div>

      {/* Manual Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110] p-4">
          <div className="bg-zinc-900 border border-violet-900/50 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-8 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold">Edit Detected Players</h2>
              <button onClick={() => setShowEditor(false)} className="text-zinc-400 hover:text-white"><X className="w-8 h-8" /></button>
            </div>
            <div className="p-8 space-y-6">
              {editingPlayers.map((player, index) => (
                <div key={player.id} className="grid grid-cols-3 gap-6 bg-zinc-800 p-6 rounded-2xl">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Name</label>
                    <input 
                      value={player.name} 
                      onChange={(e) => {
                        const newList = [...editingPlayers];
                        newList[index].name = e.target.value;
                        setEditingPlayers(newList);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Age</label>
                    <input 
                      type="number" 
                      value={player.age} 
                      onChange={(e) => {
                        const newList = [...editingPlayers];
                        newList[index].age = parseInt(e.target.value) || 22;
                        setEditingPlayers(newList);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Position</label>
                    <select 
                      value={player.position} 
                      onChange={(e) => {
                        const newList = [...editingPlayers];
                        newList[index].position = e.target.value;
                        setEditingPlayers(newList);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3"
                    >
                      {positionFilters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-8 border-t flex justify-end gap-4">
              <button onClick={() => setShowEditor(false)} className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl">Cancel</button>
              <button onClick={saveEditedPlayers} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center gap-2">
                <Save className="w-5 h-5" /> Save & Calculate Scores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Modal with 3 bars */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-violet-900/50 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-auto">
            <div className="p-8 border-b flex justify-between items-start">
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
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 text-center text-xs text-zinc-500 border-t border-violet-900/50">
        FM Value Scout V5
      </footer>
    </div>
  );
}