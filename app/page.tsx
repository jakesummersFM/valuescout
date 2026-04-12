'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import Tesseract from 'tesseract.js';
import { Upload, Download, X, BarChart3, Heart, FileText, Tv, MessageCircle, Users, HelpCircle, Trash2, Copy, Image as ImageIcon } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'upload' | 'howto' | 'filters' | 'squad' | 'compare' | 'screenshot'>('upload');
  const [balancedMode, setBalancedMode] = useState(false);
  const [squad, setSquad] = useState<Player[]>([]);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [formation, setFormation] = useState('4-3-3');
  const [screenshotProcessing, setScreenshotProcessing] = useState(false);

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

  // Improved Screenshot Upload with better OCR handling
  const handleScreenshotUpload = async (files: FileList) => {
    setScreenshotProcessing(true);
    setUploadMessage({ type: 'warning', text: 'Processing screenshots with OCR... This may take 10-30 seconds per image.' });

    const allParsedPlayers: Player[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { data: { text } } = await Tesseract.recognize(file, 'eng', { logger: m => console.log(m) });

        // Improved parsing - split into lines and try to extract structured data
        const lines = text.split('\n').filter(line => line.trim().length > 10);

        lines.forEach((line, index) => {
          // Look for common patterns in FM player lists
          const nameMatch = line.match(/([A-Z][a-zA-Z\s-']{3,30})/);
          const ageMatch = line.match(/\b(\d{1,2})\b/);
          const posMatch = line.match(/\b(GK|ST|CM|CDM|CB|WB|AM|Winger|D \(C\)|M \(C\))\b/i);

          if (nameMatch && nameMatch[0].length > 3) {
            const fakeRow = {
              Name: nameMatch[0].trim(),
              Age: ageMatch ? ageMatch[1] : '24',
              Position: posMatch ? posMatch[0] : 'Unknown',
              'Transfer Value': '£500K',
              Wage: '£5K p/w',
              League: 'Unknown League',
              Minutes: '2000',
            };

            const group = getPositionGroup(fakeRow.Position);
            const league = fakeRow.League;
            const { score, perfPercent, valuePercent, agePercent } = calculateValueScore(fakeRow, group, league);
            const valueM = 0.5;
            const age = parseInt(fakeRow.Age) || 24;
            const badge = calculateBadge(score, valueM, age);

            allParsedPlayers.push({
              id: Date.now() + i + index,
              rank: allParsedPlayers.length + 1,
              name: fakeRow.Name,
              nationality: '🌍',
              age,
              position: group,
              league,
              valueScore: score,
              keyStat: 'OCR Extracted',
              transferValue: fakeRow['Transfer Value'],
              wage: fakeRow.Wage,
              rawData: fakeRow,
              badge,
              perfPercent,
              valuePercent,
              agePercent,
            });
          }
        });
      } catch (err) {
        console.error('OCR error for file', file.name, err);
      }
    }

    if (allParsedPlayers.length > 0) {
      setPlayers(allParsedPlayers);
      setUploadMessage({ 
        type: 'success', 
        text: `✅ Processed ${allParsedPlayers.length} players from screenshots (OCR may have some errors - check the table)` 
      });
    } else {
      setUploadMessage({ type: 'error', text: 'No players could be extracted from the screenshots. Try clearer images or use CSV export instead.' });
    }

    setScreenshotProcessing(false);
  };

  const handleFileUpload = (file: File) => {
    if (file.name.toLowerCase().endsWith('.csv')) {
      parseAndProcessCSV(file);
    } else if (file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      handleScreenshotUpload(dt.files);
    }
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
              <div className="text-xs text-violet-400 -mt-1">V5 • Screenshot Backup</div>
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
        {/* Sidebar unchanged */}
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
          <div className="flex border-b border-violet-900/50 mb-8 overflow-x-auto">
            {['upload', 'howto', 'filters', 'squad', 'compare', 'screenshot'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)}
                className={`px-8 py-4 font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === tab ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                {tab === 'upload' && 'Upload CSV'}
                {tab === 'howto' && <><HelpCircle className="w-4 h-4" /> How to Use</>}
                {tab === 'filters' && 'Export Filters'}
                {tab === 'squad' && <><Users className="w-4 h-4" /> Squad Builder</>}
                {tab === 'compare' && 'Compare'}
                {tab === 'screenshot' && <><ImageIcon className="w-4 h-4" /> Screenshot Upload (No Mod)</>}
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

          {/* Screenshot Tab - FIXED */}
          {activeTab === 'screenshot' && (
            <div>
              <div className="bg-zinc-900/80 border-2 border-dashed border-violet-700 rounded-3xl p-16 text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-6 text-violet-400" />
                <h2 className="text-2xl font-semibold mb-3">Upload Screenshots of Player Lists</h2>
                <p className="text-zinc-400 mb-6 max-w-md mx-auto">
                  Take clear screenshots of FM26 player lists or individual players. 
                  The app will attempt to read the data using OCR. Best results with high-resolution, well-lit screenshots showing consistent columns.
                </p>
                <label className="bg-violet-600 hover:bg-violet-500 text-white px-10 py-4 rounded-2xl font-semibold cursor-pointer inline-block">
                  Choose Screenshots
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                    onChange={(e) => e.target.files && handleScreenshotUpload(e.target.files)} 
                  />
                </label>
                {screenshotProcessing && <div className="mt-6 text-amber-400">Processing screenshots with OCR... Please wait (10-30s per image).</div>}
                {uploadMessage && <div className={`mt-8 text-sm ${uploadMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{uploadMessage.text}</div>}
              </div>

              <div className="mt-8 text-center text-xs text-zinc-500">
                Note: OCR is a backup method and may have errors. For best accuracy, use the BepInEx Player Export mod.
              </div>
            </div>
          )}

          {/* Other tabs (howto, filters, squad, compare) - keep your existing content */}
          {activeTab === 'howto' && (<div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 text-center text-zinc-400">How to Use guide coming soon</div>)}
          {activeTab === 'filters' && (<div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 text-center text-zinc-400">Export Filters coming soon</div>)}
          {activeTab === 'squad' && (<div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 text-center text-zinc-400">Squad Builder coming soon</div>)}
          {activeTab === 'compare' && <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-10 text-center text-zinc-400">Player Comparison (coming soon)</div>}
        </div>

        {/* About Sidebar unchanged */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-zinc-900/80 border border-violet-900/50 rounded-3xl p-6 sticky top-24">
            <h3 className="font-semibold mb-4 text-violet-300">Jake Summers FM</h3>
            <p className="text-sm text-zinc-400 mb-6">Free Moneyball scouting tool for FM26.</p>
            <div className="space-y-3">
              <a href="https://twitter.com/JakeSummersFM" target="_blank" className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition">
                <MessageCircle className="w-5 h-5 text-sky-400" /> @JakeSummersFM
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

      {/* Player Modal unchanged */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
          <div className="bg-zinc-900 border border-violet-900/50 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-auto">
            {/* Same clean modal with three bars and colored stats grid as before */}
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