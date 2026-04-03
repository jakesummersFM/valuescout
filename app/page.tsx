'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, Download, Plus, Trash2, Users, X, Eye, BarChart3, Heart, Info, Copy, FileText } from 'lucide-react';
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

export default function FMValueScoutV3() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'filters'>('upload');

  const recommendedColumns: Record<string, string[]> = {
    'Central Defender': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Tck C', 'Interceptions', 'Itc'],
    'Wing Back': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Interceptions', 'Key', 'Key Passes', 'Assists'],
    'Centre Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles', 'Key', 'Key Passes', 'Assists'],
    'Attacking Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Key', 'Key Passes', 'Shots', 'xG'],
    'Winger': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Key', 'Key Passes', 'Shots', 'xG', 'Cr C'],
    'Striker': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Shots', 'xG'],
    'Goalkeeper': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Sv %', 'Svh', 'Clean Sheets', 'Save %'],
    'All Positions': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes']
  };

  const getPositionGroup = (pos: string): string => {
    const p = (pos || '').toLowerCase();
    if (p.includes('gk')) return 'GK';
    if (p.includes('wing back') || p.includes('wb')) return 'Wing Back';
    if (p.includes('dc') || p.includes('cb')) return 'Central Defender';
    if (p.includes('cm') || p.includes('dm')) return 'Centre Mid';
    if (p.includes('am')) return 'Attacking Mid';
    if (p.includes('winger') || p.includes('rw') || p.includes('lw')) return 'Winger';
    if (p.includes('st') || p.includes('cf')) return 'Striker';
    return 'Other';
  };

  const getLeagueMultiplier = (league: string): number => {
    const l = (league || '').toLowerCase();
    if (l.includes('premier') || l.includes('bundesliga') || l.includes('la liga') || l.includes('serie a') || l.includes('ligue 1')) return 1.25;
    if (l.includes('championship') || l.includes('2. bundesliga') || l.includes('ligue 2')) return 1.12;
    return 1.05;
  };

  const calculateValueScore = (row: any, position: string, league: string): { score: number; perfPercent: number; valuePercent: number; agePercent: number } => {
    const getNum = (keys: string[], def = 0) => {
      for (const key of keys) {
        let val = row[key] || row[key.toLowerCase()] || row[key.replace(/ /g, '')] || row[key.replace('%', ' %')];
        if (val !== undefined) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) return num;
        }
      }
      return def;
    };

    const minutes = getNum(['Minutes', 'Mins', 'Min', '90s']) || 90;
    const per90 = (stat: number) => (minutes > 0 ? stat / (minutes / 90) : stat);

    const goals = per90(getNum(['Goals', 'Gls']));
    const assists = per90(getNum(['Assists', 'Ast']));
    const xG = per90(getNum(['xG']));
    const keyPasses = per90(getNum(['Key Passes', 'KP', 'Key']));
    const shots = per90(getNum(['Shots']));
    const crosses = per90(getNum(['Cr C', 'Crosses']));
    const savePct = getNum(['Sv %', 'Save %', 'Save Percentage', 'Saves %']);
    const cleanSheets = getNum(['Clean Sheets']);

    let performance = 0;

    switch (position) {
      case 'GK':
        const saveScore = savePct * 1.85;
        const csPer90 = cleanSheets / (minutes / 90);
        performance = Math.min(42, saveScore + (csPer90 * 8));   // Realistic GK scoring
        break;
      case 'Winger':
      case 'Attacking Mid':
        performance = (assists * 2.8) + (keyPasses * 2.9) + (goals * 2.5) + (shots * 0.9) + (xG > 0 ? (goals / xG) * 45 : goals * 35) + (crosses * 0.6);
        break;
      case 'Striker':
        performance = (goals * 4.0) + (assists * 2.2) + (xG > 0 ? (goals / xG) * 55 : goals * 42) + (shots * 1.0);
        break;
      case 'Centre Mid':
        performance = (keyPasses * 2.7) + (assists * 2.2) + (goals * 1.7);
        break;
      case 'Wing Back':
        performance = (keyPasses * 2.5) + (assists * 2.0) + (goals * 1.5);
        break;
      default:
        performance = (goals + assists + keyPasses + shots) * 2.7;
    }

    const leagueMultiplier = getLeagueMultiplier(league);
    let baseScore = performance * 2.55;

    const valueStr = String(row['Transfer Value'] || row.Value || '0').replace(/[^0-9.-]/g, '');
    const valueM = Math.max(0.05, parseFloat(valueStr) || 0.5);
    const wageK = Math.max(0.5, (getNum(['Wage']) || 1000) / 1000);

    const efficiency = Math.min(48, Math.max(22, 92 / (valueM * 0.4 + wageK * 0.6)));

    const age = parseInt(row.Age) || 25;
    const ageBonus = age <= 21 ? 24 : age <= 23 ? 16 : age <= 26 ? 9 : age >= 33 ? -11 : 0;

    let finalScore = (baseScore * 0.53) + (efficiency * 0.35) + ageBonus;
    finalScore *= leagueMultiplier;

    const score = Math.max(48, Math.min(99, Math.round(finalScore)));

    const perfPercent = Math.round(Math.min(100, (baseScore * 0.53 / Math.max(finalScore, 1)) * 100)) || 65;
    const valuePercent = Math.round(Math.min(100, (efficiency * 0.35 / Math.max(finalScore, 1)) * 100)) || 60;
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
              keyStat: group === 'GK' 
                ? `Save %: ${row['Sv %'] || row['Save %'] || '-'} | CS: ${row['Clean Sheets'] || '-'}` 
                : group === 'Winger' || group === 'Attacking Mid' 
                ? `Key: ${row['Key'] || '-'} | Shots: ${row['Shots'] || '-'} | xG: ${row['xG'] || '-'}` 
                : `Key: ${row['Key'] || row['Key Passes'] || '-'}`,
              transferValue: row['Transfer Value'] || row.Value || '£0',
              wage: row.Wage || '£0',
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
          text: `Loaded ${parsedPlayers.length} players! V3 scoring active.` 
        });
        setIsProcessing(false);
      },
      error: () => {
        setUploadMessage({ type: 'error', text: 'Failed to parse CSV' });
        setIsProcessing(false);
      }
    });
  }, []);

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage({ type: 'error', text: 'Please upload a CSV file' });
      return;
    }
    parseAndProcessCSV(file);
  };

  const filteredPlayers = useMemo(() => {
    return selectedPositionFilter === 'All' 
      ? players 
      : players.filter(p => p.position === selectedPositionFilter);
  }, [players, selectedPositionFilter]);

  const addToShortlist = (player: Player) => {
    if (!shortlist.find(p => p.id === player.id)) setShortlist([...shortlist, player]);
  };

  const removeFromShortlist = (id: number) => setShortlist(shortlist.filter(p => p.id !== id));

  const clearShortlist = () => setShortlist([]);

  const exportShortlist = () => {
    if (shortlist.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + shortlist.map(p => `${p.name},${p.age},${p.position},${p.league},${p.valueScore},${p.transferValue},${p.wage}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fm-value-scout-shortlist.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyColumns = (position: string) => {
    const cols = recommendedColumns[position] || recommendedColumns['All Positions'];
    navigator.clipboard.writeText(cols.join(', '));
    alert(`✅ Copied recommended columns for ${position}`);
  };

  const downloadColumns = (position: string) => {
    const cols = recommendedColumns[position] || recommendedColumns['All Positions'];
    const content = `Recommended columns for ${position} (FM Value Scout)\n\n${cols.join('\n')}\n\nAlways include: Name, Position, Age, Transfer Value, Wage, League, Minutes`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ValueScout-${position.replace(/\s+/g, '-')}-Columns.txt`;
    link.click();
  };

  const columns = React.useMemo(() => [
    { accessorKey: 'rank', header: 'Rank' },
    {
      accessorKey: 'name',
      header: 'Player',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <span className="text-2xl">{row.original.nationality}</span>
          <div>
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-xs text-zinc-500">{row.original.position} • {row.original.league}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'valueScore',
      header: 'Value Score',
      cell: ({ row }: any) => {
        const score = row.original.valueScore;
        const color = score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-violet-500' : 'bg-orange-500';
        const badge = row.original.badge;
        return (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
            </div>
            <div className="flex items-center gap-1 font-mono font-bold text-lg">
              {score}
              {badge.icon && <span className="text-xl ml-1" title={badge.label}>{badge.icon}</span>}
            </div>
          </div>
        );
      },
    },
    { accessorKey: 'keyStat', header: 'Key Stat' },
    { accessorKey: 'transferValue', header: 'Value' },
    { accessorKey: 'wage', header: 'Wage' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <button 
            onClick={() => setSelectedPlayer(row.original)}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-sm flex items-center gap-2 transition"
          >
            <Eye className="w-4 h-4" /> Stats
          </button>
          <button 
            onClick={() => addToShortlist(row.original)}
            disabled={shortlist.some(p => p.id === row.original.id)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 rounded-xl text-sm flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      ),
    },
  ], [shortlist]);

  const table = useReactTable({
    data: filteredPlayers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-zinc-100 flex flex-col">
      <nav className="border-b border-violet-900/50 bg-[#0F0A1F]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white">VS</div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-white">FM Value Scout</div>
              <div className="text-xs text-violet-400 -mt-1">V3 • Moneyball for Football Manager</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.open('https://ko-fi.com/jakesummersfm', '_blank')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-zinc-800 rounded-2xl transition"
            >
              <Heart className="w-4 h-4 text-red-400" /> Support
            </button>
            <button 
              onClick={exportShortlist}
              disabled={shortlist.length === 0}
              className="bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 px-6 py-3 rounded-2xl font-medium flex items-center gap-3 transition"
            >
              <Download className="w-5 h-5" /> Export Shortlist ({shortlist.length})
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8 flex-1">
        {/* Position Filter Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-6 sticky top-24">
            <h3 className="font-semibold mb-4 text-lg text-violet-300">Filter Results</h3>
            <div className="space-y-2">
              {positionFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSelectedPositionFilter(filter.value)}
                  className={`w-full text-left px-5 py-3 rounded-2xl transition-all ${
                    selectedPositionFilter === filter.value 
                      ? 'bg-violet-600 text-white font-medium' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div className="flex-1 space-y-8">
          <div className="flex border-b border-violet-900/50">
            <button 
              onClick={() => setActiveTab('upload')} 
              className={`px-8 py-4 font-medium transition ${activeTab === 'upload' ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Upload CSV
            </button>
            <button 
              onClick={() => setActiveTab('filters')} 
              className={`px-8 py-4 font-medium transition ${activeTab === 'filters' ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Downloadable Filters
            </button>
          </div>

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div>
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} 
                onDragLeave={() => setIsDragging(false)} 
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }} 
                className={`bg-zinc-900/80 border-2 border-dashed border-violet-700 ${isDragging ? 'border-violet-500 bg-violet-950/30' : ''} rounded-3xl p-12 text-center transition-all`}
              >
                <Upload className="w-16 h-16 mx-auto mb-6 text-violet-400" />
                <h2 className="text-2xl font-semibold mb-3 text-white">Drop your FM CSV here</h2>

                <details className="text-left text-sm text-zinc-400 mb-8 max-w-md mx-auto cursor-pointer">
                  <summary className="font-medium hover:text-violet-400 mb-2">How to Export the Perfect CSV</summary>
                  <div className="mt-3 text-xs space-y-4">
                    <div className="bg-zinc-800 p-4 rounded-2xl">
                      <strong>Best Time:</strong> Export after 20–25+ games for reliable spread.
                    </div>
                    <p><strong>Pro Tip:</strong> Filter to one position before exporting.</p>
                  </div>
                </details>

                <label className="bg-violet-600 hover:bg-violet-500 text-white px-10 py-4 rounded-2xl font-semibold cursor-pointer transition inline-block">
                  Choose CSV File
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </label>

                {uploadMessage && (
                  <div className={`mt-8 text-sm ${uploadMessage.type === 'success' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {uploadMessage.text}
                  </div>
                )}
              </div>

              {players.length > 0 && (
                <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl overflow-hidden mt-8">
                  <div className="px-8 py-6 border-b border-violet-900/50">
                    <h3 className="text-xl font-semibold text-white">
                      {selectedPositionFilter === 'All' ? 'All Players' : selectedPositionFilter} • {filteredPlayers.length} ranked
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                          <tr key={headerGroup.id} className="border-b border-violet-900/50 bg-zinc-950">
                            {headerGroup.headers.map(header => (
                              <th 
                                key={header.id}
                                onClick={header.column.getToggleSortingHandler()}
                                className="px-8 py-5 text-left text-sm font-medium text-zinc-400 hover:text-white cursor-pointer"
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {table.getRowModel().rows.map(row => (
                          <tr key={row.id} className="border-b border-violet-900/30 hover:bg-violet-950/30 transition">
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
                </div>
              )}
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-8">
              <h2 className="text-2xl font-semibold mb-2 text-white">Downloadable Export Filters</h2>
              <p className="text-zinc-400 mb-8">Filter to one position first, then add these columns for best results.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(recommendedColumns).map((pos) => (
                  <div key={pos} className="bg-zinc-800 rounded-3xl p-6 border border-violet-900/50">
                    <div className="font-semibold text-lg mb-4 text-violet-300">{pos}</div>
                    <div className="text-sm text-zinc-400 mb-6 space-y-1 font-mono">
                      {recommendedColumns[pos].map((col, i) => <div key={i}>• {col}</div>)}
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => copyColumns(pos)} 
                        className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 py-3 rounded-2xl transition"
                      >
                        <Copy className="w-4 h-4" /> Copy Columns
                      </button>
                      <button 
                        onClick={() => downloadColumns(pos)} 
                        className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 py-3 rounded-2xl transition"
                      >
                        <FileText className="w-4 h-4" /> Download TXT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* About / Socials Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-6 sticky top-24">
            <h3 className="font-semibold mb-4 text-lg flex items-center gap-2 text-violet-300">
              Jake Summers FM ✍️
            </h3>
            
            <p className="text-sm text-zinc-400 mb-6">
              Creator of FM Value Scout. Passionate about Moneyball-style scouting in Football Manager. 
              Helping the community find real value on a budget.
            </p>

            <div className="space-y-3">
              <a 
                href="https://twitter.com/JakeSummersFM" 
                target="_blank" 
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition"
              >
                <Twitter className="w-5 h-5 text-sky-400" />
                <div>
                  <div className="font-medium text-sm">Twitter / X</div>
                  <div className="text-xs text-zinc-500">@JakeSummersFM</div>
                </div>
              </a>

              <a 
                href="https://www.twitch.tv/jakesummersfm" 
                target="_blank" 
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition"
              >
                <Twitch className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-medium text-sm">Twitch</div>
                  <div className="text-xs text-zinc-500">Live FM saves & scouting</div>
                </div>
              </a>

              <a 
                href="https://ko-fi.com/jakesummersfm" 
                target="_blank" 
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition"
              >
                <Heart className="w-5 h-5 text-red-400" />
                <div>
                  <div className="font-medium text-sm">Support on Ko-fi</div>
                  <div className="text-xs text-zinc-500">Keep the tool free</div>
                </div>
              </a>
            </div>

            <div className="mt-8 text-xs text-zinc-500 text-center">
              Thank you for using FM Value Scout ❤️
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-violet-900/50 py-8 text-center text-xs text-zinc-500 mt-auto">
        Made with ❤️ for the Football Manager community • V3
      </footer>

      {/* Player Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-violet-900/50 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-8 border-b border-violet-900/50 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{selectedPlayer.nationality}</span>
                <div>
                  <h2 className="text-3xl font-bold">{selectedPlayer.name}</h2>
                  <p className="text-emerald-400">{selectedPlayer.position} • {selectedPlayer.league} • Age {selectedPlayer.age}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPlayer(null)} className="text-zinc-400 hover:text-white">
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="p-8 flex-1 overflow-auto">
              <div className="text-center mb-10">
                <div className="text-8xl font-bold text-emerald-400">{selectedPlayer.valueScore}</div>
                <div className="text-xl text-zinc-400">Value Score</div>
                {selectedPlayer.badge.icon && <div className="text-5xl mt-6">{selectedPlayer.badge.icon} {selectedPlayer.badge.label}</div>}
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

              <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> All Exported Stats</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {Object.entries(selectedPlayer.rawData).map(([key, value]) => (
                  <div key={key} className="bg-zinc-800 p-4 rounded-2xl">
                    <div className="text-zinc-400 text-xs uppercase tracking-widest">{key}</div>
                    <div className="font-medium mt-1 break-all">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-violet-900/50">
              <button 
                onClick={() => { addToShortlist(selectedPlayer); setSelectedPlayer(null); }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold flex items-center justify-center gap-3"
              >
                <Plus className="w-5 h-5" /> Add to Shortlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}