'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, Download, X, BarChart3, Heart, FileText, Tv, AtSign, Users, HelpCircle, Trash2, Copy, Plus } from 'lucide-react';
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

export default function FMValueScoutV5() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [selectedPositionFilter, setSelectedPositionFilter] = useState('All');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'howto' | 'filters' | 'squad' | 'compare'>('upload');
  const [balancedMode, setBalancedMode] = useState(false);
  const [squad, setSquad] = useState<Player[]>([]);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [formation, setFormation] = useState('4-3-3');

  const recommendedColumns: Record<string, string[]> = {
    'Central Defender': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles (Tck C)', 'Interceptions (Itc)'],
    'CDM': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles (Tck C)', 'Interceptions (Itc)', 'Key Passes (Key)', 'Pas %'],
    'Wing Back': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles (Tck C)', 'Interceptions (Itc)', 'Key Passes (Key)', 'Assists'],
    'Centre Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Tackles (Tck C)', 'Key Passes (Key)', 'Assists'],
    'Attacking Mid': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Key Passes (Key)', 'Shots', 'xG'],
    'Winger': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Key Passes (Key)', 'Shots', 'xG'],
    'Striker': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Goals', 'Assists', 'Shots', 'xG'],
    'GK': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes', 'Save % (Sv %)', 'Clean Sheets'],
    'All': ['Name', 'Position', 'Age', 'Transfer Value', 'Wage', 'League', 'Minutes']
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

  const getLeagueMultiplier = (league: string): number => {
    const l = (league || '').toLowerCase();
    if (l.includes('premier') || l.includes('bundesliga') || l.includes('la liga') || l.includes('serie a') || l.includes('ligue 1')) return 1.25;
    if (l.includes('championship')) return 1.12;
    return 1.0;
  };

  const calculateValueScore = (row: any, position: string, league: string) => {
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

    const minutes = getNum(['Minutes', 'Mins', 'Min']) || 90;
    const per90 = (stat: number) => (minutes > 0 ? stat / (minutes / 90) : stat);

    const goals = per90(getNum(['Goals', 'Gls']));
    const assists = per90(getNum(['Assists', 'Ast']));
    const xG = per90(getNum(['xG']));
    const keyPasses = per90(getNum(['Key Passes', 'KP', 'Key']));
    const shots = per90(getNum(['Shots']));
    const tackles = per90(getNum(['Tackles', 'Tck C']));
    const interceptions = per90(getNum(['Interceptions', 'Itc']));
    const savePct = getNum(['Sv %', 'Save %']);
    const cleanSheets = getNum(['Clean Sheets']);
    const passPct = getNum(['Pas %', 'Pass %']);

    let performance = 0;
    if (position === 'GK') {
      performance = Math.min(42, savePct * 1.85 + (cleanSheets / (minutes / 90)) * 8);
    } else if (['Central Defender', 'CDM', 'Wing Back'].includes(position)) {
      performance = (tackles * 4.2) + (interceptions * 4.0) + (keyPasses * 1.5) + (minutes / 100);
    } else {
      performance = (goals * 3.8) + (assists * 2.4) + (xG > 0 ? (goals / xG) * 50 : goals * 40) + (shots * 0.9) + (keyPasses * 1.8);
    }

    const leagueMultiplier = getLeagueMultiplier(league);
    let baseScore = performance * 2.45;
    let valueM = Math.max(0.3, parseFloat(String(row['Transfer Value'] || '0').replace(/[^0-9.-]/g, '')) || 0.5);
    const wageK = Math.max(0.5, (getNum(['Wage']) || 1000) / 1000);
    const efficiency = Math.min(45, Math.max(25, 88 / (valueM * 0.45 + wageK * 0.55)));

    const age = parseInt(row.Age) || 25;
    let ageBonus = age <= 21 ? 16 : age <= 23 ? 11 : age <= 26 ? 7 : age >= 33 ? -12 : 0;
    const minutesFactor = minutes < 1200 ? 0.78 : minutes < 800 ? 0.65 : 1.0;

    let finalScore = ((baseScore * 0.55) + (efficiency * 0.33) + ageBonus) * minutesFactor * leagueMultiplier;
    if (balancedMode) finalScore *= 0.92;

    const score = Math.max(48, Math.min(97, Math.round(finalScore)));

    const perfPercent = Math.round(Math.min(100, (baseScore * 0.55 / Math.max(finalScore, 1)) * 100)) || 65;
    const valuePercent = Math.round(Math.min(100, (efficiency * 0.33 / Math.max(finalScore, 1)) * 100)) || 60;
    const agePercent = Math.round(Math.min(100, (ageBonus / Math.max(finalScore, 1)) * 100)) || 45;

    return { score, perfPercent, valuePercent, agePercent };
  };

  const calculateBadge = (score: number, valueM: number, age: number) => {
    if (score >= 88 && (age <= 23 || valueM <= 12)) return { type: 'gem' as const, label: 'Hidden Gem', icon: '💎' };
    if (score < 60 && valueM > 25) return { type: 'avoid' as const, label: "Don't Touch", icon: '🚫' };
    if (score >= 82 && valueM > 40) return { type: 'overpriced' as const, label: 'Overpriced', icon: '⚠️' };
    if (score < 72 && valueM < 10) return { type: 'overrated' as const, label: 'Overrated', icon: '🔥' };
    return { type: 'none' as const, label: '', icon: '' };
  };

  const parseAndProcessCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setUploadMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedPlayers: Player[] = results.data
          .map((row: any, index: number) => {
            const rawPos = row.Position || row.Pos || '';
            const group = getPositionGroup(rawPos);
            const league = row.League || row.Division || '';
            const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(row, group, league);
            const valueM = Math.max(0.3, parseFloat(String(row['Transfer Value'] || '0').replace(/[^0-9.-]/g, '')) || 0.5);
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
              keyStat: group === 'GK' ? `Save %: ${row['Sv %'] || '-'}` :
                       (group === 'CDM' || group === 'Wing Back' || group === 'Central Defender') 
                       ? `Tck: ${row['Tck C'] || '-'} | Itc: ${row['Itc'] || '-'}` 
                       : `Key: ${row['Key'] || row['Key Passes'] || '-'}`,
              transferValue: row['Transfer Value'] || '£0',
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
        setUploadMessage({ type: 'success', text: `✅ Loaded ${parsedPlayers.length} players` });
        setIsProcessing(false);
      },
      error: () => {
        setUploadMessage({ type: 'error', text: 'Failed to parse CSV' });
        setIsProcessing(false);
      }
    });
  }, [balancedMode]);

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage({ type: 'error', text: 'Please upload a CSV file' });
      return;
    }
    parseAndProcessCSV(file);
  };

  const filteredPlayers = useMemo(() => {
    return selectedPositionFilter === 'All' ? players : players.filter(p => p.position === selectedPositionFilter);
  }, [players, selectedPositionFilter]);

  const copyPlayerName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
  };

  const table = useReactTable({
    data: filteredPlayers,
    columns: [
      { accessorKey: 'rank', header: 'Rank' },
      { accessorKey: 'name', header: 'Player' },
      { accessorKey: 'position', header: 'Position' },
      { accessorKey: 'age', header: 'Age' },
      { accessorKey: 'league', header: 'League' },
      { accessorKey: 'keyStat', header: 'Key Stat' },
      { 
        accessorKey: 'valueScore', 
        header: 'Value Score',
        cell: ({ row }) => <div className="font-mono font-bold text-emerald-400 text-xl">{row.original.valueScore}</div>
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const player = row.original;
          return (
            <div className="flex gap-2">
              <button onClick={() => setSelectedPlayer(player)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm flex items-center gap-2">View</button>
              <button onClick={() => copyPlayerName(player.name)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm flex items-center gap-2" title="Copy player name">
                <Copy className="w-4 h-4" /> {copiedName === player.name ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => {
                if (!shortlist.find(p => p.id === player.id)) setShortlist([...shortlist, player]);
              }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm flex items-center gap-2">+ Shortlist</button>
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

  const exportShortlistCSV = () => {
    if (shortlist.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," + shortlist.map(p => `${p.name},${p.age},${p.position},${p.league},${p.valueScore},${p.transferValue},${p.wage}`).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "value-scout-shortlist.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportShortlistPDF = () => {
    if (shortlist.length === 0) return;
    const doc = new jsPDF();
    doc.text("FM Value Scout V5 - Shortlist", 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Player', 'Position', 'Age', 'League', 'Score', 'Value', 'Wage']],
      body: shortlist.map(p => [p.name, p.position, p.age, p.league, p.valueScore, p.transferValue, p.wage]),
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }
    });
    doc.save("ValueScout_Shortlist.pdf");
  };

  // Squad drag & drop
  const handleDragStart = (e: React.DragEvent, player: Player) => {
    e.dataTransfer.setData('playerId', player.id.toString());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const playerId = parseInt(e.dataTransfer.getData('playerId'));
    const player = shortlist.find(p => p.id === playerId);
    if (player && !squad.find(p => p.id === player.id)) {
      setSquad([...squad, player]);
    }
  };

  const squadStats = useMemo(() => {
    if (squad.length === 0) return { avgScore: '0.0', totalWage: '0', avgAge: '0.0', gems: 0 };
    const totalScore = squad.reduce((sum, p) => sum + p.valueScore, 0);
    const totalWage = squad.reduce((sum, p) => {
      const wageNum = parseFloat(p.wage.replace(/[^0-9.-]/g, '')) || 0;
      return sum + wageNum;
    }, 0);
    const totalAge = squad.reduce((sum, p) => sum + p.age, 0);
    const gems = squad.filter(p => p.badge.type === 'gem').length;

    return {
      avgScore: (totalScore / squad.length).toFixed(1),
      totalWage: totalWage.toFixed(0),
      avgAge: (totalAge / squad.length).toFixed(1),
      gems
    };
  }, [squad]);

  const getStatColor = (key: string, value: any, position: string) => {
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
    if (num === 0) return 'text-red-400';

    if (['Central Defender', 'CDM', 'Wing Back'].includes(position)) {
      if (key.toLowerCase().includes('tck') || key.toLowerCase().includes('itc') || key.toLowerCase().includes('tackles') || key.toLowerCase().includes('interceptions')) {
        return num > 40 ? 'text-emerald-400' : num > 20 ? 'text-amber-400' : 'text-red-400';
      }
    } else if (['Striker', 'Attacking Mid', 'Winger'].includes(position)) {
      if (key.toLowerCase().includes('xg') || key.toLowerCase().includes('goals') || key.toLowerCase().includes('shots')) {
        return num > 0.8 ? 'text-emerald-400' : num > 0.4 ? 'text-amber-400' : 'text-red-400';
      }
    }
    return 'text-zinc-100';
  };

  return (
    <div className="min-h-screen bg-[#0F0A1F] text-zinc-100">
      {/* Navigation */}
      <nav className="border-b border-violet-900/50 bg-[#0F0A1F]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl font-bold">VS</div>
            <div>
              <div className="text-3xl font-bold">FM Value Scout</div>
              <div className="text-xs text-violet-400 -mt-1">V5 • Squad Builder</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://ko-fi.com/jakesummersfm" target="_blank" className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-zinc-800 rounded-2xl transition">
              <Heart className="w-4 h-4 text-red-400" /> Support
            </a>
            <button onClick={exportShortlistCSV} disabled={shortlist.length === 0} className="bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 px-6 py-3 rounded-2xl font-medium flex items-center gap-3 transition">
              <Download className="w-5 h-5" /> CSV ({shortlist.length})
            </button>
            <button onClick={exportShortlistPDF} disabled={shortlist.length === 0} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 px-6 py-3 rounded-2xl font-medium flex items-center gap-3 transition">
              <FileText className="w-5 h-5" /> PDF
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-6 sticky top-24">
            <h3 className="font-semibold mb-4 text-violet-300">Position Filter</h3>
            <div className="space-y-2">
              {positionFilters.map((f) => (
                <button key={f.value} onClick={() => setSelectedPositionFilter(f.value)}
                  className={`w-full text-left px-5 py-3 rounded-2xl transition ${selectedPositionFilter === f.value ? 'bg-violet-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-2">
              <input type="checkbox" checked={balancedMode} onChange={(e) => setBalancedMode(e.target.checked)} className="accent-violet-500" />
              <label className="text-sm">Balanced Mode</label>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex border-b border-violet-900/50 mb-8">
            {['upload', 'howto', 'filters', 'squad', 'compare'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)}
                className={`px-8 py-4 font-medium transition flex items-center gap-2 ${activeTab === tab ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                {tab === 'upload' && 'Upload CSV'}
                {tab === 'howto' && <><HelpCircle className="w-4 h-4" /> How to Use</>}
                {tab === 'filters' && 'Export Filters'}
                {tab === 'squad' && <><Users className="w-4 h-4" /> Squad Builder</>}
                {tab === 'compare' && 'Compare'}
              </button>
            ))}
          </div>

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div>
              <div className={`bg-zinc-900/80 border-2 border-dashed border-violet-700 rounded-3xl p-16 text-center transition-all ${isDragging ? 'border-violet-500 bg-violet-950/30' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}>
                <Upload className="w-16 h-16 mx-auto mb-6 text-violet-400" />
                <h2 className="text-2xl font-semibold mb-3">Drop your FM CSV here</h2>
                <label className="bg-violet-600 hover:bg-violet-500 text-white px-10 py-4 rounded-2xl font-semibold cursor-pointer inline-block">
                  Choose CSV File
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </label>
                {uploadMessage && <div className={`mt-8 text-sm ${uploadMessage.type === 'success' ? 'text-emerald-400' : uploadMessage.type === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>{uploadMessage.text}</div>}
              </div>

              {players.length > 0 && (
                <div className="mt-8 bg-zinc-900/80 border border-violet-900/50 rounded-3xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="border-b border-violet-900/50 bg-zinc-950">
                          {headerGroup.headers.map(header => (
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
            </div>
          )}

          {/* Detailed How to Use */}
          {activeTab === 'howto' && (
            <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 prose prose-invert max-w-none">
              <h2 className="text-3xl font-bold mb-8">How to Use FM Value Scout V5</h2>
              
              <h3 className="text-xl font-semibold mb-4">1. Export the Perfect CSV from FM</h3>
              <p>Always export <strong>one position at a time</strong> for the most accurate scores.</p>
              <div className="bg-zinc-800 rounded-2xl p-6 text-sm my-6">
                Recommended columns (use the Export Filters tab):
                <ul className="mt-4 space-y-1 text-emerald-400 font-mono">
                  <li>• Strikers / Wingers / AM: Goals, Assists, Shots, xG, Key Passes</li>
                  <li>• CDMs / Defenders: Tackles (Tck C), Interceptions (Itc), Key Passes, Pas %</li>
                  <li>• GK: Save %, Clean Sheets</li>
                </ul>
              </div>

              <h3 className="text-xl font-semibold mb-4">2. Upload & Get Results</h3>
              <p>Drag and drop your CSV. The app automatically detects position and calculates a Moneyball Value Score using stats, wage, age and transfer value.</p>
              <ul className="list-disc pl-5 mt-4 space-y-2">
                <li>Use Balanced Mode if too many wonderkids score 99</li>
                <li>Minimum 1,200 minutes recommended for reliable scores</li>
                <li>Click any player to see the three breakdown bars and colored stats grid (green = strong, orange = average, red = weak for that position)</li>
                <li>Use the Copy Name button to quickly copy player names</li>
              </ul>

              <h3 className="text-xl font-semibold mb-4">3. Squad Builder (New in V5)</h3>
              <p>Go to the Squad Builder tab. Drag players from your shortlist onto the pitch. Choose formation and see real-time squad stats (average score, total wage, average age, hidden gems).</p>

              <h3 className="text-xl font-semibold mb-4">4. Best Practices</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Filter to one position in FM before exporting</li>
                <li>Check the colored stats grid in the player modal for quick comparison</li>
                <li>Use the Export Filters tab to get the exact columns FM needs</li>
              </ul>

              <div className="mt-12 text-center text-sm text-zinc-400">
                Need more help? Join the Discord or reply on Twitter @JakeSummersFM<br />
                The tool is 100% free and improves with your feedback ❤️
              </div>
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10">
              <h2 className="text-2xl font-semibold mb-6">Export Filters (Copy & Paste in FM)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(recommendedColumns).map(([pos, cols]) => (
                  <div key={pos} className="bg-zinc-800 rounded-3xl p-6">
                    <div className="font-semibold text-lg mb-4 text-violet-300">{pos}</div>
                    <div className="text-sm font-mono text-zinc-400 mb-6 space-y-1">
                      {cols.map((col, i) => <div key={i}>• {col}</div>)}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(cols.join(', ')); alert('Copied!'); }} className="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-2xl">
                      Copy Columns
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Squad Builder Tab */}
          {activeTab === 'squad' && (
            <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold flex items-center gap-3"><Users className="w-6 h-6" /> Squad Builder</h2>
                <div className="flex items-center gap-4">
                  <select value={formation} onChange={(e) => setFormation(e.target.value)} className="bg-zinc-800 text-white px-4 py-2 rounded-2xl">
                    <option value="4-3-3">4-3-3</option>
                    <option value="4-2-3-1">4-2-3-1</option>
                    <option value="4-4-2">4-4-2</option>
                    <option value="3-5-2">3-5-2</option>
                  </select>
                  <button onClick={() => setSquad([])} className="text-red-400 flex items-center gap-2 text-sm">
                    <Trash2 className="w-4 h-4" /> Clear Squad
                  </button>
                </div>
              </div>

              {/* Visual Pitch */}
              <div 
                className="bg-emerald-950 border-2 border-emerald-700 rounded-3xl p-12 min-h-[420px] relative grid grid-cols-5 gap-6"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="bg-zinc-900/70 border border-emerald-600 rounded-2xl flex items-center justify-center text-xs text-emerald-300 font-medium min-h-[90px]">
                    Slot {i+1}
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h4 className="text-sm text-zinc-400 mb-3">Your Shortlist (drag to squad)</h4>
                <div className="flex flex-wrap gap-3">
                  {shortlist.map((player) => (
                    <div 
                      key={player.id} 
                      draggable 
                      onDragStart={(e) => {
                        e.dataTransfer.setData('playerId', player.id.toString());
                      }}
                      className="bg-zinc-800 px-4 py-2 rounded-2xl flex items-center gap-3 cursor-grab text-sm hover:bg-zinc-700"
                    >
                      <span>{player.name}</span>
                      <span className="font-mono text-emerald-400">{player.valueScore}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Squad Stats */}
              <div className="mt-8 bg-zinc-800 rounded-3xl p-6">
                <h3 className="font-semibold mb-6">Squad Stats</h3>
                <div className="grid grid-cols-4 gap-6 text-sm">
                  <div>
                    <div className="text-zinc-400">Avg Score</div>
                    <div className="text-3xl font-mono text-emerald-400">{squadStats.avgScore}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Total Wage</div>
                    <div className="text-3xl font-mono">£{squadStats.totalWage}k p/w</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Avg Age</div>
                    <div className="text-3xl font-mono">{squadStats.avgAge}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Hidden Gems</div>
                    <div className="text-3xl font-mono text-amber-400">{squadStats.gems} 💎</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compare' && <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 text-center text-zinc-400">Player Comparison (coming soon in future update)</div>}
        </div>

        {/* About Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-6 sticky top-24">
            <h3 className="font-semibold mb-4 text-violet-300">Jake Summers FM</h3>
            <p className="text-sm text-zinc-400 mb-6">Free Moneyball scouting tool for FM26.</p>
            <div className="space-y-3">
              <a href="https://twitter.com/JakeSummersFM" target="_blank" className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition">
                <AtSign className="w-5 h-5 text-sky-400" /> @JakeSummersFM
              </a>
              <a href="https://www.twitch.tv/jakesummersfm" target="_blank" className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition">
                <Tv className="w-5 h-5 text-purple-400" /> Twitch
              </a>
              <a href="https://ko-fi.com/jakesummersfm" target="_blank" className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition">
                <Heart className="w-5 h-5 text-red-400" /> Support on Ko-fi
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Player Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-violet-900/50 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-auto">
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

            <div className="p-8">
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
                    <div className={`font-medium mt-1 break-all ${getStatColor(key, value, selectedPlayer.position)}`}>
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-violet-900/50 py-8 text-center text-xs text-zinc-500">
        Made with ❤️ for the FM community • FM Value Scout V5
      </footer>
    </div>
  );
}