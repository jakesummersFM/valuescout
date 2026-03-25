"use client";
import { useState } from "react";

type Player = {
  name: string;
  age: number;
  pos: string;
  value: string;
  stat1: number;
  stat2: number;
  stat3: number;
  score?: number;
  role?: string;
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [compare, setCompare] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataQuality, setDataQuality] = useState<any>(null);

  // --- CSV PARSER ---
  const parseCSV = (text: string): Player[] => {
    const rows = text.split("\n").map(r => r.split(","));
    const headers = rows[0].map(h => h.toLowerCase());

    return rows.slice(1).map(r => ({
      name: r[headers.indexOf("name")] || "",
      age: Number(r[headers.indexOf("age")]) || 0,
      pos: r[headers.indexOf("position")] || "",
      value: r[headers.indexOf("value")] || "",
      stat1: Number(r[headers.findIndex(h => h.includes("goal") || h.includes("assist") || h.includes("tackle"))]) || 0,
      stat2: Number(r[headers.findIndex(h => h.includes("xg") || h.includes("key") || h.includes("interception"))]) || 0,
      stat3: Number(r[headers.findIndex(h => h.includes("shot") || h.includes("%") || h.includes("clearance"))]) || 0,
    }));
  };

  // --- SCORING ---
  const scorePlayer = (p: Player): Player => {
    let score = 0;
    let role = "Squad Player";

    const value = parseInt(p.value.replace(/[^0-9]/g, "")) || 1000000;

    const s1 = p.stat1 || 0;
    const s2 = p.stat2 || 0;
    const s3 = p.stat3 || 0;

    if (p.pos.includes("ST")) {
      const eff = s2 > 0 ? s1 / s2 : 0;
      score = s1 * 0.5 + s2 * 0.2 + s3 * 0.1 + eff * 10;
      role = eff > 1.2 ? "Clinical Finisher" : "Elite Finisher";
    } else if (p.pos.includes("CM") || p.pos.includes("AM")) {
      score = s1 * 0.3 + s2 * 0.5 + s3 * 0.2;
      role = "Playmaker";
    } else if (p.pos.includes("CB")) {
      score = s1 * 0.5 + s2 * 0.4 + s3 * 0.1;
      role = "Ball Winner";
    } else if (p.pos.includes("GK")) {
      score = s1 * 0.6 + s2 * 0.2 + s3 * 0.2;
      role = "Shot Stopper";
    }

    score = score - p.age * 0.4 - value / 200000;
    if (p.age < 23) score += 5;

    return { ...p, score: Math.round(score), role };
  };

  // --- DATA QUALITY ---
  const checkQuality = (players: Player[]) => {
    let missing = 0;
    players.forEach(p => {
      if (!p.stat1) missing++;
      if (!p.stat2) missing++;
      if (!p.stat3) missing++;
    });

    const ratio = 1 - missing / (players.length * 3);

    if (ratio > 0.8) return { text: "High Quality", color: "text-green-400" };
    if (ratio > 0.5) return { text: "Medium Quality", color: "text-yellow-400" };
    return { text: "Low Quality", color: "text-red-400" };
  };

  // --- UPLOAD ---
  const handleFile = async (file: File) => {
    setLoading(true);
    const text = await file.text();

    const parsed = parseCSV(text)
      .map(scorePlayer)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    setPlayers(parsed);
    setDataQuality(checkQuality(parsed));
    setLoading(false);
  };

  // --- SHORTLIST ---
  const addToShortlist = (p: Player) => {
    if (!shortlist.find(s => s.name === p.name)) {
      setShortlist([...shortlist, p]);
    }
  };

  // --- COMPARE ---
  const toggleCompare = (p: Player) => {
    if (compare.find(c => c.name === p.name)) {
      setCompare(compare.filter(c => c.name !== p.name));
    } else if (compare.length < 2) {
      setCompare([...compare, p]);
    }
  };

  return (
    <div className="bg-slate-950 text-white min-h-screen">

      {/* HERO */}
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold">FM Value Scout</h1>
        <p className="text-slate-400 mt-2">Find hidden gems instantly</p>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
          className="mt-6"
        />

        {loading && <p className="text-emerald-400 mt-4">Analyzing players...</p>}
      </div>

      {/* DATA QUALITY */}
      {dataQuality && (
        <p className={`text-center mb-6 ${dataQuality.color}`}>
          {dataQuality.text}
        </p>
      )}

      {/* TABLE */}
      <div className="max-w-5xl mx-auto px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th>Name</th><th>Age</th><th>Pos</th><th>Score</th><th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {players.map((p, i) => (
              <tr key={i} className="border-b border-slate-800 text-center">
                <td>{p.name}</td>
                <td>{p.age}</td>
                <td>{p.pos}</td>
                <td className="text-emerald-400">{p.score}</td>

                <td className="space-x-2">
                  <button onClick={() => addToShortlist(p)}>⭐</button>
                  <button onClick={() => toggleCompare(p)}>⚖️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SHORTLIST */}
      {shortlist.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 mt-10">
          <h2 className="mb-2">⭐ Shortlist</h2>
          {shortlist.map((p, i) => (
            <p key={i}>{p.name} ({p.score})</p>
          ))}
        </div>
      )}

      {/* COMPARE */}
      {compare.length === 2 && (
        <div className="max-w-5xl mx-auto px-6 mt-10">
          <h2 className="mb-2">⚖️ Compare</h2>
          <div className="grid grid-cols-2 gap-4">
            {compare.map((p, i) => (
              <div key={i} className="bg-slate-900 p-4 rounded">
                <h3>{p.name}</h3>
                <p>Score: {p.score}</p>
                <p>Age: {p.age}</p>
                <p>Pos: {p.pos}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
