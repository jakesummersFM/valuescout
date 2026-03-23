"use client";

import { useState } from "react";

type Player = {
  name: string;
  pos: string;
  age: number;
  value: number;
  wage: number;
  goals: number;
  assists: number;
  xg: number;
  tackles: number;
  interceptions: number;
  score: number;
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [compare, setCompare] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [ageFilter, setAgeFilter] = useState(40);

  const parseNumber = (val: string | undefined): number => {
    if (!val) return 0;
    return Number(val.replace(/[£,]/g, "")) || 0;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    const reader = new FileReader();

    reader.onload = (evt: ProgressEvent<FileReader>) => {
      const text = evt.target?.result as string;
      const rows = text.split("\n").filter((r) => r.trim() !== "");

      const delimiter = rows[0].includes(";") ? ";" : ",";

      const headers = rows[0]
        .split(delimiter)
        .map((h: string) => h.trim().toLowerCase());

      const data: Player[] = rows.slice(1).map((row: string) => {
        const values = row.split(delimiter);

        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = values[i];
        });

        const age = Number(obj.age) || 20;
        const value = parseNumber(obj.value);
        const wage = parseNumber(obj.wage);

        const goals = Number(obj.goals) || 0;
        const assists = Number(obj.assists) || 0;
        const xg = Number(obj.xg) || 0;
        const tackles = Number(obj.tackles) || 0;
        const interceptions = Number(obj.interceptions) || 0;

        // ⚡ Balanced scoring (not harsh)
        let score =
          goals * 3 +
          assists * 2 +
          xg * 2 +
          tackles * 1 +
          interceptions * 1;

        score += (26 - age) * 1.2;
        score += (15000000 - value) / 1500000;

        score = Math.max(1, Math.min(99, Math.round(score)));

        return {
          name: obj.name || "Unknown",
          pos: obj.position || "UNK",
          age,
          value,
          wage,
          goals,
          assists,
          xg,
          tackles,
          interceptions,
          score,
        };
      });

      setPlayers(data.sort((a, b) => b.score - a.score));
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const toggleShortlist = (p: Player) => {
    setShortlist((prev) =>
      prev.find((s) => s.name === p.name)
        ? prev.filter((s) => s.name !== p.name)
        : [...prev, p]
    );
  };

  const toggleCompare = (p: Player) => {
    setCompare((prev) => {
      if (prev.find((c) => c.name === p.name)) {
        return prev.filter((c) => c.name !== p.name);
      }
      if (prev.length < 2) return [...prev, p];
      return prev;
    });
  };

  const filteredPlayers = players.filter(
    (p) =>
      (positionFilter === "ALL" || p.pos === positionFilter) &&
      p.age <= ageFilter
  );

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "Arial",
        color: "white",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.25), transparent), linear-gradient(180deg, #020617 0%, #0b1220 100%)",
      }}
    >
      <h1>💎 ValueScout Elite</h1>

      <input type="file" onChange={handleFile} />

      {loading && <p>Analyzing players...</p>}

      {/* FILTERS */}
      <div style={{ marginTop: 20 }}>
        <select onChange={(e) => setPositionFilter(e.target.value)}>
          <option value="ALL">All Positions</option>
          <option value="ST">ST</option>
          <option value="CM">CM</option>
          <option value="CB">CB</option>
          <option value="GK">GK</option>
        </select>

        <input
          type="range"
          min="16"
          max="40"
          value={ageFilter}
          onChange={(e) => setAgeFilter(Number(e.target.value))}
        />
        Age ≤ {ageFilter}
      </div>

      {/* SHORTLIST */}
      {shortlist.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>⭐ Shortlist</h2>
          {shortlist.map((p, i) => (
            <div key={i}>
              {p.name} ({p.score})
            </div>
          ))}
        </div>
      )}

      {/* COMPARE */}
      {compare.length === 2 && (
        <div style={{ marginTop: 20 }}>
          <h2>⚖️ Compare</h2>
          <div style={{ display: "flex", gap: 40 }}>
            {compare.map((p, i) => (
              <div key={i}>
                <h3>{p.name}</h3>
                <p>Score: {p.score}</p>
                <p>Goals: {p.goals}</p>
                <p>Assists: {p.assists}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLAYERS */}
      <div style={{ marginTop: 20 }}>
        {filteredPlayers.map((p, i) => (
          <div
            key={i}
            style={{
              padding: 15,
              marginBottom: 10,
              borderRadius: 10,
              background: "#111827",
            }}
          >
            <h3>
              {p.name} ({p.score})
            </h3>
            <p>
              {p.pos} | Age {p.age}
            </p>

            <button onClick={() => toggleShortlist(p)}>
              ⭐ Shortlist
            </button>

            <button onClick={() => toggleCompare(p)}>
              ⚖️ Compare
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
