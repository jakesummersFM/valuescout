"use client";
import { useState } from "react";

type Player = {
  name: string;
  age: number;
  pos: string;
  value: string;
  goals: number;
  xg: number;
  shots: number;
  score?: number;
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  // --- SAFE CSV PARSER ---
  const parseCSV = (text: string): Player[] => {
    const rows = text.split("\n").map(r => r.split(","));
    const headers = rows[0].map(h => h.trim().toLowerCase());

    const get = (row: string[], key: string) => {
      const i = headers.findIndex(h => h.includes(key));
      return i !== -1 ? row[i] : "";
    };

    return rows.slice(1).map(r => ({
      name: get(r, "name") || "Unknown",
      age: Number(get(r, "age")) || 0,
      pos: get(r, "position") || "",
      value: get(r, "value") || "0",
      goals: Number(get(r, "goal")) || 0,
      xg: Number(get(r, "xg")) || 0,
      shots: Number(get(r, "shot")) || 0,
    }));
  };

  // --- SCORING ---
  const scorePlayer = (p: Player): Player => {
    const value = parseInt((p.value || "0").replace(/[^0-9]/g, "")) || 1000000;

    const efficiency = p.xg > 0 ? p.goals / p.xg : 0;

    let score =
      p.goals * 0.6 +
      p.xg * 0.2 +
      p.shots * 0.1 +
      efficiency * 10;

    score = score - p.age * 0.3 - value / 200000;

    if (p.age < 23) score += 5;

    return { ...p, score: Math.round(score) };
  };

  // --- FILE UPLOAD ---
  const handleFile = async (file: File) => {
    setLoading(true);
    const text = await file.text();

    const parsed = parseCSV(text)
      .map(scorePlayer)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    setPlayers(parsed);
    setLoading(false);
  };

  // --- SHORTLIST ---
  const addToShortlist = (p: Player) => {
    if (!shortlist.find(s => s.name === p.name)) {
      setShortlist([...shortlist, p]);
    }
  };

  const removeFromShortlist = (p: Player) => {
    setShortlist(shortlist.filter(s => s.name !== p.name));
  };

  return (
    <div className="bg-slate-950 text-white min-h-screen">

      {/* HERO */}
      <section className="text-center px-6 py-16">
        <h1 className="text-4xl font-bold mb-2">
          FM Value Scout
        </h1>

        <p className="text-slate-400 mb-6">
          Find hidden gems instantly
        </p>

        <input
          type="file"
          accept=".csv"
          onChange={(e) =>
            e.target.files && handleFile(e.target.files[0])
          }
          className="text-sm"
        />

        {loading && (
          <p className="text-emerald-400 mt-4">
            Analyzing players...
          </p>
        )}
      </section>

      {/* PLAYER GRID */}
      <section className="max-w-6xl mx-auto px-6 pb-12">

        <h2 className="mb-4 text-lg font-semibold">
          🔍 Results
        </h2>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {players.map((p, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4"
            >
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-slate-400">
                {p.pos} • Age {p.age}
              </p>

              <p className="text-emerald-400 mt-2 text-lg">
                {p.score}
              </p>

              <button
                onClick={() => addToShortlist(p)}
                className="mt-3 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1 rounded text-sm"
              >
                ⭐ Save
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SHORTLIST */}
      {shortlist.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <h2 className="mb-4 text-lg font-semibold">
            ⭐ Shortlist
          </h2>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {shortlist.map((p, i) => (
              <div
                key={i}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4"
              >
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-slate-400">
                  {p.pos} • Age {p.age}
                </p>

                <p className="text-emerald-400 mt-2">
                  {p.score}
                </p>

                <button
                  onClick={() => removeFromShortlist(p)}
                  className="mt-3 bg-red-500 hover:bg-red-400 text-black px-3 py-1 rounded text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
