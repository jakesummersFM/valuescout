// @ts-nocheck
"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();

    const rows = text.split("\n").map((r) => r.split(","));
    const headers = rows[0].map((h) => h.toLowerCase().trim());

    const find = (names) =>
      headers.findIndex((h) =>
        names.some((n) => h.includes(n))
      );

    const idx = {
      name: find(["name"]),
      age: find(["age"]),
      pos: find(["position", "pos"]),
      wage: find(["wage"]),

      goals: find(["goal"]),
      xg: find(["xg"]),
      assists: find(["assist"]),
      shots: find(["shot"]),
      aerial: find(["aerial"]),

      tackles: find(["tackle"]),
      interceptions: find(["interception"]),

      prog: find(["progressive"]),
      pass: find(["pass"]),

      saves: find(["save"]),
      conceded: find(["conceded"]),
      clean: find(["clean"]),
    };

    const parsed = rows.slice(1).map((r) => {
      const get = (i) => (i >= 0 ? parseFloat(r[i]) || 0 : 0);

      const wageRaw = r[idx.wage] || "0";
      const wage = parseFloat(wageRaw.replace(/[^0-9.]/g, "")) || 1;

      return {
        name: r[idx.name],
        age: get(idx.age),
        pos: (r[idx.pos] || "").toUpperCase(),
        wage,

        goals: get(idx.goals),
        xg: get(idx.xg),
        assists: get(idx.assists),
        shots: get(idx.shots),
        aerial: get(idx.aerial),

        tackles: get(idx.tackles),
        interceptions: get(idx.interceptions),

        prog: get(idx.prog),
        pass: get(idx.pass),

        saves: get(idx.saves),
        conceded: get(idx.conceded),
        clean: get(idx.clean),
      };
    });

    const scored = parsed.map((p) => {
      let output = 0;

      const type = p.pos.includes("GK")
        ? "gk"
        : p.pos.includes("DF")
        ? "def"
        : p.pos.includes("MF")
        ? "mid"
        : "att";

      if (type === "gk") {
        output =
          p.saves * 5 +
          p.clean * 4 -
          p.conceded * 3 +
          p.pass * 1;
      }

      if (type === "def") {
        output =
          p.tackles * 4 +
          p.interceptions * 3 +
          p.aerial * 2 +
          p.pass * 1;
      }

      if (type === "mid") {
        output =
          p.prog * 3 +
          p.assists * 4 +
          p.pass * 2;
      }

      if (type === "att") {
        output =
          p.goals * 5 +
          p.xg * 3 +
          p.shots * 2 +
          p.aerial * 1;
      }

      const efficiency = output / (p.wage / 1000);
      const value = Math.max(1, Math.min(100, efficiency * 10000));

      return { ...p, value: Math.round(value) };
    });

    setPlayers(scored.sort((a, b) => b.value - a.value));
  };

  const filtered = players.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const top = players[0];

  const getColor = (v) => {
    if (v > 70) return "text-green-400";
    if (v > 40) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950 to-black text-white p-8">

      {/* HEADER */}
      <h1 className="text-4xl font-bold text-purple-400 mb-2">
        ValueScout 💰
      </h1>
      <p className="text-gray-400 mb-8">
        Find elite performance at low cost
      </p>

      {/* TOP PLAYER */}
      {top && (
        <div className="bg-purple-800/30 backdrop-blur-md p-6 rounded-2xl mb-8 border border-purple-500 shadow-lg">
          <p className="text-sm text-gray-300">Top Value Player</p>
          <h2 className="text-2xl font-bold">{top.name}</h2>
          <p className="text-gray-300">
            £{top.wage} • {top.pos} • Age {top.age}
          </p>
          <p className={`text-2xl font-bold mt-2 ${getColor(top.value)}`}>
            Value Score: {top.value}
          </p>
        </div>
      )}

      {/* CONTROLS */}
      <div className="flex gap-4 mb-6">
        <input
          type="file"
          onChange={handleFile}
          className="bg-purple-700/50 p-2 rounded cursor-pointer"
        />

        <input
          placeholder="Search player..."
          className="bg-black/50 border border-purple-500 p-2 rounded w-64"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl border border-purple-800">
        <table className="w-full text-left">
          <thead className="bg-purple-900/70">
            <tr>
              <th className="p-3">Player</th>
              <th className="p-3">Pos</th>
              <th className="p-3">Age</th>
              <th className="p-3">Wage</th>
              <th className="p-3">Value</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((p, i) => (
              <tr
                key={i}
                className="border-t border-purple-800 hover:bg-purple-800/30 transition"
              >
                <td className="p-3 font-semibold">{p.name}</td>
                <td className="p-3">{p.pos}</td>
                <td className="p-3">{p.age}</td>
                <td className="p-3">£{p.wage}</td>
                <td className={`p-3 font-bold ${getColor(p.value)}`}>
                  {p.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="mt-10 text-center text-gray-500 text-sm">
        Moneyball Analytics • ValueScout ⚽
      </div>

    </div>
  );
}