"use client";
import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);
  const [shortlist, setShortlist] = useState<any[]>([]);
  const [best, setBest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // --- CSV PARSER ---
  const parseCSV = (text: string) => {
    const rows = text.split("\n").map(r => r.split(","));
    const headers = rows[0].map(h => h.toLowerCase());

    const getIndex = (key: string) =>
      headers.findIndex(h => h.includes(key));

    return { rows: rows.slice(1), headers, getIndex };
  };

  // --- DETECT MODEL ---
  const detectModel = (headers: string[]) => {
    if (headers.some(h => h.includes("save"))) return "gk";
    if (headers.some(h => h.includes("goal"))) return "att";
    if (headers.some(h => h.includes("key pass") || h.includes("progress"))) return "mid";
    if (headers.some(h => h.includes("tackle") || h.includes("interception"))) return "def";
    return "generic";
  };

  // --- ROLE LABELS ---
  const getRole = (model: string, score: number) => {
    if (model === "att") return score > 25 ? "Elite Finisher" : "Attacker";
    if (model === "mid") return score > 20 ? "Playmaker" : "Midfielder";
    if (model === "def") return score > 20 ? "Ball Winner" : "Defender";
    if (model === "gk") return score > 20 ? "Shot Stopper" : "Goalkeeper";
    return "Player";
  };

  // --- SCORING ---
  const scorePlayer = (row: string[], model: string, get: any) => {
    const age = Number(get("age")) || 0;
    const value = parseInt((get("value") || "0").replace(/[^0-9]/g, "")) || 1000000;

    let s = 0;

    if (model === "gk") {
      s = Number(get("save")) * 0.6 + Number(get("saves")) * 0.4;
    }

    if (model === "att") {
      const g = Number(get("goal"));
      const xg = Number(get("xg"));
      const sh = Number(get("shot"));
      const eff = xg > 0 ? g / xg : 0;
      s = g * 0.6 + xg * 0.2 + sh * 0.1 + eff * 10;
    }

    if (model === "mid") {
      s =
        Number(get("key")) * 0.4 +
        Number(get("progress")) * 0.3 +
        Number(get("%")) * 0.3;
    }

    if (model === "def") {
      s =
        Number(get("tackle")) * 0.3 +
        Number(get("interception")) * 0.25 +
        Number(get("clear")) * 0.25 +
        Number(get("aerial")) * 0.2;
    }

    s = s - age * 0.3 - value / 200000;
    if (age < 23) s += 5;

    return Math.round(s);
  };

  // --- FILE HANDLER ---
  const handleFile = async (file: File) => {
    setLoading(true);
    const text = await file.text();

    const { rows, headers, getIndex } = parseCSV(text);
    const model = detectModel(headers);

    const data = rows.map(r => {
      const get = (k: string) => {
        const i = getIndex(k);
        return i !== -1 ? r[i] : "";
      };

      const score = scorePlayer(r, model, get);

      return {
        name: get("name") || "Unknown",
        age: Number(get("age")) || 0,
        pos: get("position") || "",
        value: get("value") || "",
        score,
        role: getRole(model, score),
      };
    }).sort((a, b) => b.score - a.score);

    setPlayers(data);
    setBest(data[0]);
    setLoading(false);
  };

  const add = (p: any) => {
    if (!shortlist.find(s => s.name === p.name)) {
      setShortlist([...shortlist, p]);
    }
  };

  return (
    <div className="bg-[#020617] text-white min-h-screen p-6">

      {/* HEADER */}
      <h1 className="text-3xl font-bold mb-4">💎 FM Value Scout</h1>

      {/* UPLOAD */}
      <div className="border border-slate-800 rounded-xl p-6 mb-6 text-center">
        <input type="file" onChange={(e)=>e.target.files && handleFile(e.target.files[0])} />
        <p className="text-sm text-slate-400 mt-2">
          Upload CSV (best results: one position at a time)
        </p>
        {loading && <p className="text-green-400 mt-2">Analyzing...</p>}
      </div>

      {/* BEST BARGAIN */}
      {best && (
        <div className="mb-6 p-6 rounded-xl border border-green-500 bg-gradient-to-r from-green-900/40 to-transparent">
          <p className="text-green-400 text-sm">🏆 Best Bargain</p>
          <h2 className="text-2xl">{best.name}</h2>
          <p className="text-slate-300">{best.pos} • Age {best.age}</p>
          <p className="text-green-400 text-xl">
            {best.score} — {best.role}
          </p>
        </div>
      )}

      {/* HIDDEN GEMS */}
      <h2 className="mb-4">💎 Hidden Gems</h2>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {players.slice(0, 12).map((p, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3>{p.name}</h3>
            <p className="text-sm text-slate-400">{p.pos} • Age {p.age}</p>

            <p className="text-green-400 mt-2">
              {p.score}
            </p>

            <p className="text-xs text-slate-400">{p.role}</p>

            <button
              onClick={() => add(p)}
              className="mt-3 bg-green-500 hover:bg-green-400 px-3 py-1 rounded text-black text-sm"
            >
              ⭐ Save
            </button>
          </div>
        ))}
      </div>

      {/* SHORTLIST */}
      {shortlist.length > 0 && (
        <>
          <h2 className="mt-10 mb-4">⭐ Shortlist</h2>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {shortlist.map((p, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3>{p.name}</h3>
                <p className="text-sm text-slate-400">{p.pos} • Age {p.age}</p>
                <p className="text-green-400">{p.score}</p>
                <p className="text-xs text-slate-400">{p.role}</p>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
