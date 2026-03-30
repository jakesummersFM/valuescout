'use client';

import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, Download, Plus, Trash2, Users, X, Eye, BarChart3, Heart } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, SortingState, flexRender, Row } from '@tanstack/react-table';

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
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const getPositionGroup = (pos: string): string => {
    const p = (pos || '').toLowerCase();
    if (p.includes('gk')) return 'GK';
    if (p.includes('wing back') || p.includes('wb') || p.includes('full back')) return 'Wing Back';
    if (p.includes('dc') || p.includes('central defender') || p.includes('cb')) return 'Central Defender';
    if (p.includes('dm') || p.includes('defensive mid')) return 'Centre Mid';
    if (p.includes('cm') || p.includes('centre mid')) return 'Centre Mid';
    if (p.includes('am') || p.includes('attacking mid')) return 'Attacking Mid';
    if (p.includes('winger') || p.includes('mr') || p.includes('ml') || p.includes('rw') || p.includes('lw')) return 'Winger';
    if (p.includes('st') || p.includes('striker') || p.includes('cf')) return 'Striker';
    return 'Other';
  };

  const getLeagueMultiplier = (league: string): number => {
    const l = (league || '').toLowerCase();
    if (l.includes('premier') || l.includes('bundesliga') || l.includes('la liga') || 
        l.includes('serie a') || l.includes('ligue 1') || l.includes('champions')) return 1.25;
    if (l.includes('championship') || l.includes('2. bundesliga') || l.includes('ligue 2')) return 1.10;
    if (l.includes('league one') || l.includes('league two')) return 0.95;
    return 1.0;
  };

  const calculateValueScore = (row: Record<string, string | number | undefined>, position: string, league: string): number => {
    const getNum = (keys: string[], def = 0) => {
      for (const key of keys) {
        const val = row[key] || row[key.toLowerCase()] || row[key.replace(' ', '')];
        if (val !== undefined) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num)) return num;
        }
      }
      return def;
    };

    const goals = getNum(['Goals', 'Gls']);
    const assists = getNum(['Assists', 'Ast']);
    const xG = getNum(['xG', 'Expected Goals', 'xG/90']);
    const keyPasses = getNum(['Key Passes', 'KP']);
    const tackles = getNum(['Tackles', 'Tkl']);
    const interceptions = getNum(['Interceptions', 'Int']);
    const savePct = getNum(['Save %', 'Save Percentage', 'Saves %']);

    let performance = 0;
    switch (position) {
      case 'GK': performance = savePct * 2.2; break;
      case 'Wing Back': performance = (tackles * 1.8) + (keyPasses * 1.6) + (assists * 1.4); break;
      case 'Central Defender': performance = (tackles * 2.1) + (interceptions * 1.9); break;
      case 'Centre Mid': performance = (tackles * 1.7) + (keyPasses * 1.8) + (assists * 1.5); break;
      case 'Attacking Mid': performance = (assists * 2.2) + (keyPasses * 2.0) + (goals * 1.4); break;
      case 'Winger': performance = (assists * 1.9) + (keyPasses * 1.8) + (goals * 1.5); break;
      case 'Striker': performance = (goals * 2.5) + (assists * 1.6) + (xG > 0 ? (goals / xG) * 35 : goals * 28); break;
      default: performance = (goals + assists + tackles + keyPasses) * 1.5;
    }

    const leagueMultiplier = getLeagueMultiplier(league);
    const baseScore = performance * 2.0;

    const valueM = Math.max(0.1, (getNum(['Transfer Value', 'Value']) || 1000000) / 1000000);
    const wageK = Math.max(1, (getNum(['Wage', 'Weekly Wage']) || 1000) / 1000);
    const efficiency = Math.min(30, Math.max(8, 55 / (valueM * 0.65 + wageK * 0.35)));

    const age = parseInt(String(row.Age)) || 25;
    const ageBonus = age <= 21 ? 16 : age <= 23 ? 11 : age <= 26 ? 7 : age >= 32 ? -5 : 0;

    let finalScore = (baseScore * 0.60) + (efficiency * 0.28) + ageBonus;
    finalScore *= leagueMultiplier;

    return Math.max(42, Math.min(99, Math.round(finalScore)));
  };

  const calculateBadge = (score: number, valueM: number, age: number): Player['badge'] => {
    if (score >= 92 && (age <= 23 || valueM <= 15)) return { type: 'gem', label: 'Hidden Gem', icon: '💎' };
    if (score < 58 && valueM > 30) return { type: 'avoid', label: "Don't Touch", icon: '🚫' };
    if (score >= 80 && valueM > 45) return { type: 'overpriced', label: 'Overpriced', icon: '⚠️' };
    if (score < 70 && valueM < 12) return { type: 'overrated', label: 'Overrated', icon: '🔥' };
    return { type: 'none', label: '', icon: '' };
  };

  const parseAndProcessCSV = useCallback((file: File) => {
    setUploadMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setUploadMessage({ type: 'error', text: 'CSV is empty' });
          return;
        }

        const parsedPlayers: Player[] = (results.data as Record<string, string | number | undefined>[])
          .map((row, index: number) => {
            const rawPos = String(row.Position || row.Pos || 'Other');
            const group = getPositionGroup(rawPos);
            const league = String(row.League || row.Competition || row.Division || '');
            const score = calculateValueScore(row, group, league);
            const valueM = Math.max(0.1, (parseFloat(String(row['Transfer Value'] || row.Value || '0').replace(/[^0-9.]/g, '')) || 1000000) / 1000000);
            const age = parseInt(String(row.Age)) || 25;
            const badge = calculateBadge(score, valueM, age);

            return {
              id: Date.now() + index,
              rank: index + 1,
              name: String(row.Name || row.Player || 'Unknown Player'),
              nationality: String(row.Nationality || row.Nat || '🌍'),
              age,
              position: group,
              league: String(league),
              valueScore: score,
              keyStat: group === 'Striker' ? `xG: ${row['xG'] || '-'}` : group === 'GK' ? `Save%: ${row['Save %'] || '-'}` : `Key: ${row.Goals || row.Assists || row.Tackles || '-'}`,
              transferValue: String(row['Transfer Value'] || row.Value || '£0'),
              wage: String(row.Wage || row['Weekly Wage'] || '£0'),
              rawData: row,
              badge,
            };
          })
          .sort((a, b) => b.valueScore - a.valueScore)
          .map((p, i) => ({ ...p, rank: i + 1 }));

        setPlayers(parsedPlayers);
        setUploadMessage({ 
          type: 'success', 
          text: `Loaded ${parsedPlayers.length} players! League difficulty & stats used for scoring.` 
        });
      },
      error: () => {
        setUploadMessage({ type: 'error', text: 'Failed to parse CSV' });
      }
    });
  }, [calculateValueScore]);

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage({ type: 'error', text: 'Please upload a CSV file' });
      return;
    }
    parseAndProcessCSV(file);
  };

  const filteredPlayers = selectedPositionFilter === 'All' 
    ? players 
    : players.filter(p => p.position === selectedPositionFilter);

  const addToShortlist = useCallback((player: Player) => {
    if (!shortlist.find(p => p.id === player.id)) setShortlist([...shortlist, player]);
  }, [shortlist]);

  const columns = React.useMemo(() => [
    { accessorKey: 'rank', header: 'Rank' },
    {
      accessorKey: 'name',
      header: 'Player',
      cell: ({ row }: { row: Row<Player> }) => (
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
      cell: ({ row }: { row: Row<Player> }) => {
        const score = row.original.valueScore;
        const color = score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-500' : 'bg-orange-500';
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
      cell: ({ row }: { row: Row<Player> }) => (
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-xl text-sm flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      ),
    },
  ], [shortlist, addToShortlist]);

  const table = useReactTable({
    data: filteredPlayers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <nav className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl font-bold">VS</div>
            <div>
              <div className="text-3xl font-bold tracking-tight">FM Value Scout</div>
              <div className="text-xs text-emerald-400 -mt-1">Moneyball for Football Manager • V2</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.open('https://ko-fi.com/yourusername', '_blank')} // Replace with your actual support link
              className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-zinc-800 rounded-2xl transition"
            >
              <Heart className="w-4 h-4 text-red-400" /> Support the Tool
            </button>
            <button 
              onClick={exportShortlist}
              disabled={shortlist.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 px-6 py-3 rounded-2xl font-medium flex items-center gap-3 transition"
            >
              <Download className="w-5 h-5" /> Export Shortlist ({shortlist.length})
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8 flex-1">
        {/* Position Filters */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sticky top-24">
            <h3 className="font-semibold mb-4 text-lg">Filter by Position</h3>
            <div className="space-y-2">
              {positionFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSelectedPositionFilter(filter.value)}
                  className={`w-full text-left px-5 py-3 rounded-2xl transition-all ${
                    selectedPositionFilter === filter.value ? 'bg-emerald-500 text-black font-medium' : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Upload Area with Guidance */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}
            className={`bg-zinc-900 border-2 border-dashed ${isDragging ? 'border-emerald-500 bg-emerald-950/30' : 'border-zinc-700'} rounded-3xl p-12 text-center transition-all`}
          >
            <Upload className="w-16 h-16 mx-auto mb-6 text-emerald-400" />
            <h2 className="text-2xl font-semibold mb-3">Drop your FM CSV here</h2>
            
            <div className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
              <strong>Recommended columns for best results:</strong><br />
              Name, Position, Age, Value, Wage, Goals, xG, Assists, Tackles, Key Passes, Save %, League
            </div>

            {/* How to Export Perfect CSV Section */}
            <details className="text-left text-sm text-zinc-400 mb-8 max-w-md mx-auto">
              <summary className="cursor-pointer hover:text-emerald-400 font-medium mb-2">How to Export Perfect CSV from FM</summary>
              <ol className="list-decimal pl-5 space-y-1 text-xs">
                <li>Open Player Search in FM</li>
                <li>Right-click column headers → Customize View</li>
                <li>Add: Name, Position, Age, Value, Wage, Goals, xG, Assists, Tackles, Key Passes, Save %, League</li>
                <li>Click File → Print Screen → Web Page → Save as CSV</li>
              </ol>
            </details>

            <label className="bg-white text-black px-10 py-4 rounded-2xl font-semibold cursor-pointer hover:bg-zinc-200 transition inline-block">
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
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden">
              <div className="px-8 py-6 border-b border-zinc-700">
                <h3 className="text-xl font-semibold">
                  {selectedPositionFilter === 'All' ? 'All Players' : selectedPositionFilter} • {filteredPlayers.length} ranked
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id} className="border-b border-zinc-800 bg-zinc-950">
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
                      <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/70 transition">
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

        {/* Shortlist */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sticky top-24">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-semibold">Shortlist</div>
                  <div className="text-xs text-zinc-500">{shortlist.length} players</div>
                </div>
              </div>
              {shortlist.length > 0 && <button onClick={clearShortlist} className="text-red-400 hover:text-red-500 text-sm">Clear</button>}
            </div>

            {shortlist.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">Add players from the table</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {shortlist.map(player => (
                  <div key={player.id} className="bg-zinc-800 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-emerald-400 text-sm">{player.valueScore} • {player.position}</div>
                    </div>
                    <button onClick={() => removeFromShortlist(player.id)} className="text-zinc-400 hover:text-red-400">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          Made with ❤️ for the Football Manager community • 
          <button 
            onClick={() => window.open('https://ko-fi.com/yourusername', '_blank')} 
            className="hover:text-emerald-400 ml-1 underline"
          >
            Support the Tool
          </button>
        </div>
      </footer>

      {/* Player Modal with Bar Charts */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-8 border-b border-zinc-700 flex justify-between items-start">
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

              {/* Bar Charts */}
              <div className="space-y-8 mb-12">
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Performance (Stats)</span>
                    <span className="font-mono text-emerald-400">70%</span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '70%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Value for Money</span>
                    <span className="font-mono text-amber-400">65%</span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: '65%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Age Factor</span>
                    <span className="font-mono text-purple-400">45%</span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: '45%' }} />
                  </div>
                </div>
              </div>

              {/* All Exported Stats */}
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> All Exported Stats
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {Object.entries(selectedPlayer.rawData).map(([key, value]) => (
                  <div key={key} className="bg-zinc-800 p-4 rounded-2xl">
                    <div className="text-zinc-400 text-xs uppercase tracking-widest">{key}</div>
                    <div className="font-medium mt-1 break-all">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-zinc-700">
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