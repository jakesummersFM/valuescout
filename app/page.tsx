'use client';

import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, Download, Plus, Trash2, Diamond, Users, AlertCircle } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, SortingState, flexRender } from '@tanstack/react-table';

interface Player {
  id: number;
  rank: number;
  name: string;
  nationality: string;
  age: number;
  valueScore: number;
  keyStat: string;
  transferValue: string;
  wage: string;
  rawData?: any; // Store original row for future advanced calculations
}

const positions = ['Attackers', 'Midfielders', 'Defenders', 'Goalkeepers'];

export default function ValueScout() {
  const [activePosition, setActivePosition] = useState('Attackers');
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Simple mock Value Score calculator (replace with your real logic later)
  const calculateValueScore = (row: any, position: string): number => {
    // Example logic - customize based on your actual FM CSV columns
    let performance = 0;
    let costEfficiency = 0;

    // Common FM columns you might have
    const goals = parseFloat(row.Goals) || 0;
    const assists = parseFloat(row.Assists) || 0;
    const xG = parseFloat(row['xG']) || parseFloat(row['Expected Goals']) || 0;
    const value = parseFloat((row['Transfer Value'] || row.Value || '0').replace(/[^0-9.]/g, '')) || 1;
    const wage = parseFloat((row.Wage || row['Weekly Wage'] || '0').replace(/[^0-9.]/g, '')) || 1;

    if (position === 'Attackers') {
      performance = (goals * 1.5 + assists + (xG > 0 ? goals / xG * 20 : 0));
    } else if (position === 'Midfielders') {
      performance = (assists * 2 + (parseFloat(row.Tackles) || 0) * 0.8 + (parseFloat(row['Key Passes']) || 0));
    } else if (position === 'Defenders') {
      performance = (parseFloat(row.Tackles) || 0) * 1.2 + (parseFloat(row.Interceptions) || 0) * 1.5;
    } else {
      performance = parseFloat(row['Save %']) || parseFloat(row.Saves) || 50;
    }

    costEfficiency = 10000 / (value / 1000000 + wage / 1000); // rough efficiency

    const score = Math.min(99, Math.max(40, Math.round(performance * 2 + costEfficiency / 10)));
    return score;
  };

  const parseAndProcessCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setUploadMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setUploadMessage({ type: 'error', text: 'CSV appears to be empty.' });
          setIsProcessing(false);
          return;
        }

        const parsedPlayers: Player[] = results.data
          .map((row: any, index: number) => {
            const name = row.Name || row.Player || 'Unknown Player';
            const nationality = row.Nationality || row.Nat || '🇬🇧';
            const age = parseInt(row.Age) || 25;

            const valueScore = calculateValueScore(row, activePosition);

            let keyStat = 'N/A';
            if (activePosition === 'Attackers') {
              keyStat = `Goals/xG: ${(parseFloat(row.Goals) || 0).toFixed(1)}`;
            } else if (activePosition === 'Midfielders') {
              keyStat = `Assists: ${row.Assists || row['Key Passes'] || 'N/A'}`;
            } else if (activePosition === 'Defenders') {
              keyStat = `Tackles: ${row.Tackles || 'N/A'}`;
            } else {
              keyStat = `Save%: ${row['Save %'] || 'N/A'}`;
            }

            return {
              id: Date.now() + index,
              rank: index + 1,
              name,
              nationality: nationality.length > 3 ? '🌍' : nationality,
              age,
              valueScore,
              keyStat,
              transferValue: row['Transfer Value'] || row.Value || '£0',
              wage: row.Wage || row['Weekly Wage'] || '£0',
              rawData: row,
            };
          })
          .sort((a, b) => b.valueScore - a.valueScore) // Initial sort by score
          .map((player, idx) => ({ ...player, rank: idx + 1 }));

        setPlayers(parsedPlayers);
        setUploadMessage({ 
          type: 'success', 
          text: `Successfully loaded ${parsedPlayers.length} ${activePosition.toLowerCase()}!` 
        });
        setIsProcessing(false);
      },
      error: (error) => {
        setUploadMessage({ type: 'error', text: `Parse error: ${error.message}` });
        setIsProcessing(false);
      }
    });
  }, [activePosition]);

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage({ type: 'error', text: 'Please upload a CSV file only.' });
      return;
    }
    parseAndProcessCSV(file);
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const addToShortlist = (player: Player) => {
    if (!shortlist.find(p => p.id === player.id)) {
      setShortlist([...shortlist, player]);
    }
  };

  const removeFromShortlist = (id: number) => {
    setShortlist(shortlist.filter(p => p.id !== id));
  };

  // Table columns (same as before, slightly improved)
  const columns = React.useMemo(() => [
    { accessorKey: 'rank', header: 'Rank' },
    {
      accessorKey: 'name',
      header: 'Player',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <span className="text-2xl">{row.original.nationality}</span>
          <div>
            <div className="font-semibold text-white">{row.original.name}</div>
            <div className="text-xs text-zinc-500">Age {row.original.age}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'valueScore',
      header: 'Value Score',
      cell: ({ row }: any) => {
        const score = row.original.valueScore;
        const color = score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-500' : 'bg-orange-500';
        return (
          <div className="flex items-center gap-3 min-w-[140px]">
            <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={`h-full ${color} transition-all duration-500`} 
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="font-mono font-bold text-lg w-12 text-right flex items-center gap-1">
              {score}
              {score >= 92 && <Diamond className="text-emerald-400 w-5 h-5" />}
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
        <button
          onClick={() => addToShortlist(row.original)}
          disabled={shortlist.some(p => p.id === row.original.id)}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-xl text-sm flex items-center gap-2 transition font-medium"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      ),
    },
  ], [shortlist]);

  const table = useReactTable({
    data: players,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Navbar remains the same as previous version */}

      <nav className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-black font-bold text-2xl">⚽</div>
            <div>
              <div className="text-2xl font-semibold tracking-tight">Value Scout</div>
              <div className="text-xs text-emerald-400 -mt-1">Moneyball for Football Manager</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-900 rounded-xl transition text-sm">
              <Users className="w-4 h-4" /> How to Export
            </button>
            {shortlist.length > 0 && (
              <button className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl flex items-center gap-2 font-medium">
                <Download className="w-4 h-4" /> Export Shortlist
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Upload Section */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8">
            <h2 className="text-2xl font-semibold mb-2">Upload Scouting Data</h2>
            <p className="text-zinc-400 mb-6">One position group only • CSV from FM Player Search</p>

            {/* Position Tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {positions.map((pos) => (
                <button
                  key={pos}
                  onClick={() => {
                    setActivePosition(pos);
                    setPlayers([]); // Clear previous results when switching
                    setUploadMessage(null);
                  }}
                  className={`px-8 py-3 rounded-2xl font-medium transition-all ${
                    activePosition === pos 
                      ? 'bg-emerald-500 text-black shadow-lg' 
                      : 'bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Drag & Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all ${
                isDragging ? 'border-emerald-500 bg-emerald-950/30' : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <Upload className="w-16 h-16 mx-auto mb-6 text-emerald-400" />
              <p className="text-2xl font-medium mb-3">
                {isProcessing ? 'Processing CSV...' : 'Drag & Drop your FM CSV here'}
              </p>
              <p className="text-zinc-400 mb-8">or click to browse</p>

              <label className="inline-block bg-white hover:bg-zinc-200 text-black px-10 py-4 rounded-2xl font-semibold cursor-pointer transition">
                Select CSV File
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                />
              </label>

              {uploadMessage && (
                <div className={`mt-6 flex items-center justify-center gap-3 text-sm ${uploadMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {uploadMessage.type === 'error' ? <AlertCircle className="w-5 h-5" /> : null}
                  {uploadMessage.text}
                </div>
              )}
            </div>

            <div className="text-center text-xs text-zinc-500 mt-6">
              Tip: In FM, go to Player Search → customize columns → Ctrl + P → Web Page → Save as CSV
            </div>
          </div>

          {/* Players Table */}
          {players.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden">
              <div className="px-8 py-5 border-b border-zinc-700 flex justify-between">
                <h3 className="text-xl font-semibold">
                  {activePosition} • {players.length} players ranked by Value Score
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup: any) => (
                      <tr key={headerGroup.id} className="border-b border-zinc-800 bg-zinc-950">
                        {headerGroup.headers.map((header: any) => (
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
                    {table.getRowModel().rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800/70 transition">
                        {row.getVisibleCells().map((cell: any) => (
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

        {/* Shortlist Sidebar - same as before */}
        <div className="w-96 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 sticky top-24">
            {/* Shortlist content - unchanged from previous version */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-3 rounded-2xl">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-lg">Shortlist</div>
                  <div className="text-xs text-zinc-500">{shortlist.length} selected</div>
                </div>
              </div>
              {shortlist.length > 0 && (
                <button onClick={() => setShortlist([])} className="text-red-400 hover:text-red-500">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {shortlist.length === 0 ? (
              <div className="py-20 text-center text-zinc-500">
                No players added yet.<br />Click "Add" on promising players.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {shortlist.map((player, idx) => (
                  <div key={player.id} className="bg-zinc-800 rounded-2xl p-4 flex justify-between items-center group">
                    <div className="flex gap-4 items-center">
                      <div className="text-3xl">{player.nationality}</div>
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-emerald-400 font-mono text-sm">{player.valueScore} Value Score</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFromShortlist(player.id)}
                      className="opacity-40 group-hover:opacity-100 text-zinc-400 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {shortlist.length > 0 && (
              <button className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold flex items-center justify-center gap-3">
                <Download className="w-5 h-5" />
                Export Shortlist
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}