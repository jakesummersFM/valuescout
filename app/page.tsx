// @ts-nocheck
"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [shortlist, setShortlist] = useState([]);
  const [compare, setCompare] = useState([]);
  const [filterPos, setFilterPos] = useState("");
  const [maxAge, setMaxAge] = useState(50);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    const text = await file.text();

    const rows = text.split("\n").map((r) => r.split(",").map((c) => c.trim()));
    const headers = rows[0].map((h) => h.toLowerCase());

    const find = (names) =>
      headers.findIndex((h) => names.some((n) => h.includes(n)));

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
      const wage = parseFloat((r[idx.wage] || "0").replace(/[^0-9.]/g, "")) || 1;

      return {
        name: r[idx.name] || "Unknown",
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
        output = p.saves * 5 + p.clean * 4 - p.conceded * 3 + p.pass;
      }
      if (type === "def") {
        output = p.tackles * 4 + p.interceptions * 3 + p.aerial * 2 + p.pass;
      }
      if (type === "mid") {
        output = p.prog * 3 + p.assists * 4 + p.pass * 2;
      }
      if (type === "att") {
        output = p.goals * 5 + p.xg * 3 + p.shots * 2 + p.aerial;
      }

      const efficiency = output / (p.wage / 1000);
      const value = Math.max(1, Math.min(100, efficiency * 10000));

      return { ...p, value: Math.round(value) };
    });

    setPlayers(scored.sort((a, b) => b.value - a.value));
  };

  const toggleShortlist = (p) => {
    setShortlist((prev) =>
      prev.find((x) => x.name === p.name)
        ? prev.filter((x) => x.name !== p.name)
        : [...prev, p]
    );
  };

  const toggleCompare = (p) => {
    if (compare.find((x) => x.name === p.name)) {
      setCompare(compare.filter((x) => x.name !== p.name));
    } else if (compare.length < 2) {
      setCompare([...compare, p]);
    }
  };

  const exportCSV = () => {
    const rows = shortlist.map((p) =>
      [p.name, p.pos, p.age, p.wage, p.value].join(",")
    );
    const blob = new Blob([["Name,Pos,Age,Wage,Value"], ...rows].join("\n"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shortlist.csv";
    a.click();
  };

  const getColor = (v) =>
    v >= 70 ? "text-green-400" : v >= 40 ? "text-yellow-400" : "text-red-400";

  const filtered = players
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    .filter((p) => (filterPos ? p.pos.includes(filterPos) : true))
    .filter((p) => p.age <= maxAge);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950 to-black text-white p-8">

      <h1 className="text-4xl font-bold text-purple-400 mb-4">
        ValueScout 💰
      </h1>

      {/* CONTROLS */}
      <div className="flex flex-wrap gap-4 mb-6">
        <input type="file" onChange={handleFile} />

        <input
          placeholder="Search..."
          className="bg-black border p-2"
          onChange={(e) => setSearch(e.target.value)}
        />

        <select onChange={(e) => setFilterPos(e.target.value)}>
          <option value="">All Positions</option>
          <option value="GK">GK</option>
          <option value="DF">DF</option>
          <option value="MF">MF</option>
          <option value="ST">ST</option>
        </select>

        <input
          type="number"
          placeholder="Max Age"
          onChange={(e) => setMaxAge(Number(e.target.value))}
        />

        <button onClick={exportCSV} className="bg-purple-600 px-4 py-2">
          Export Shortlist
        </button>
      </div>

      {/* TABLE */}
      <table className="w-full text-left border">
        <thead>
          <tr>
            <th>Name</th>
            <th>Pos</th>
            <th>Age</th>
            <th>Wage</th>
            <th>Value</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((p, i) => (
            <tr key={i}>
              <td>{p.name}</td>
              <td>{p.pos}</td>
              <td>{p.age}</td>
              <td>£{p.wage}</td>
              <td className={getColor(p.value)}>{p.value}</td>
              <td>
                <button onClick={() => toggleShortlist(p)}>⭐</button>
                <button onClick={() => toggleCompare(p)}>⚖️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* COMPARE */}
      {compare.length === 2 && (
        <div className="mt-10 p-4 border">
          <h2 className="text-xl mb-4">Comparison</h2>
          <div className="flex justify-between">
            {compare.map((p) => (
              <div key={p.name}>
                <h3>{p.name}</h3>
                <p>Value: {p.value}</p>
                <p>Wage: £{p.wage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHORTLIST */}
      <div className="mt-10">
        <h2 className="text-xl mb-2">Shortlist</h2>
        {shortlist.map((p) => (
          <p key={p.name}>{p.name} ({p.value})</p>
        ))}
      </div>
    </div>
  );
}