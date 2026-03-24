"use client";
import { useState } from "react";

type Player = {
  name: string;
  age: number;
  pos: string;
  nation?: string;
  club?: string;
  value?: string;
  wage?: string;
  stat1: number;
  stat2: number;
  stat3: number;
  score?: number;
  role?: string;
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [shortlist, setShortlist] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔥 UNIVERSAL CSV PARSER
  const parseCSV = (text: string): Player[] => {
    const lines = text.split("\n").filter(l => l.trim() !== "");

    const detectDelimiter = (row: string) => {
      const comma = (row.match(/,/g) || []).length;
      const semi = (row.match(/;/g) || []).length;
      return semi > comma ? ";" : ",";
    };

    const delimiter = detectDelimiter(lines[0]);
    const split = (row: string) => row.split(delimiter).map(c => c.trim());
    const headers = split(lines[0]).map(h => h.toLowerCase());

    const findCol = (names: string[]) =>
      headers.findIndex(h => names.some(n => h.includes(n)));

    const COL = {
      name: findCol(["name", "player"]),
      age: findCol(["age"]),
      pos: findCol(["position"]),
      nation: findCol(["nation"]),
      club: findCol(["club"]),
      value: findCol(["value"]),
      wage: findCol(["wage"]),

      stat1: findCol(["goals", "sv %", "saves", "tackles"]),
      stat2: findCol(["assists", "xg", "interceptions"]),
      stat3: findCol(["shots", "passes", "key passes"]),
    };

    const data: Player[] = lines.slice(1).map(row => {
      const c = split(row);
      const get = (i: number) => (i >= 0 ? c[i] : "");

      return {
        name: get(COL.name),
        age: Number(get(COL.age)) || 0,
        pos: get(COL.pos),
        nation: get(COL.nation) || undefined,
        club: get(COL.club) || undefined,
        value: get(COL.value) || undefined,
        wage: get(COL.wage) || undefined,

        stat1: Number(get(COL.stat1)) || 0,
        stat2: Number(get(COL.stat2)) || 0,
        stat3: Number(get(COL.stat3)) || 0,
      };
    });

    return data.filter(
      p =>
        p.name &&
        p.pos &&
        !p.name.toLowerCase().includes("name")
    );
  };

  // 🔥 POSITION-BASED SCORING
  const scorePlayer = (p: Player): Player => {
    let score = 0;
    let role = "Squad Player";

    if (p.pos.includes("GK")) {
      score = p.stat1 * 0.6 + p.stat2 * -0.2 + p.stat3 * 0.2;
      role = "Shot Stopper";
    } else if (p.pos.includes("ST")) {
      score = p.stat1 * 0.6 + p.stat2 * 0.3 + p.stat3 * 0.1;
      role = "Elite Finisher";
    } else if (p.pos.includes("CM")) {
      score = p.stat1 * 0.3 + p.stat2 * 0.5 + p.stat3 * 0.2;
      role = "Playmaker";
    } else if (p.pos.includes("CB")) {
      score = p.stat1 * 0.5 + p.stat2 * 0.4 + p.stat3 * 0.1;
      role = "Ball Winner";
    }

    return { ...p, score: Math.round(score), role };
  };

  const handleFile = async (file: File) => {
    setLoading(true);

    const text = await file.text();
    let parsed = parseCSV(text);

    const positions = [...new Set(parsed.map(p => p.pos))];
    if (positions.length > 1) {
      alert("⚠️ Upload ONE position at a time for best results");
    }

    parsed = parsed
      .map(scorePlayer)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    setPlayers(parsed);
    setLoading(false);
  };

  const best = players[0];
  const hidden = players.slice(0, 8);

  return (
    <div style={{ padding: 20, background: "#020617", minHeight: "100vh", color: "white" }}>
      <h1>💎 FM Value Scout</h1>

      <input
        type="file"
        onChange={(e) =>
          e.target.files && handleFile(e.target.files[0])
        }
      />

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        ⚠️ Upload ONE position at a time (ST, CM, CB, GK)
      </p>

      {loading && <p>Loading...</p>}

      {best && (
        <div style={{ marginTop: 20, padding: 20, border: "1px solid #22c55e" }}>
          <h2>🏆 Best Bargain</h2>
          <p>{best.name} ({best.pos})</p>
          <p>Score: {best.score} — {best.role}</p>
        </div>
      )}

      <h3 style={{ marginTop: 20 }}>💎 Hidden Gems</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))",
          gap: 12
        }}
      >
        {hidden.map((p, i) => (
          <div key={i} style={{ border: "1px solid #1e293b", padding: 12 }}>
            <h4>{p.name}</h4>
            <p>{p.pos} • Age {p.age}</p>
            <p>Score: {p.score}</p>
            <p>{p.role}</p>

            <button
              onClick={() =>
                setShortlist(prev =>
                  prev.find(s => s.name === p.name)
                    ? prev
                    : [...prev, p]
                )
              }
              style={{ marginTop: 8 }}
            >
              ⭐ Save
            </button>
          </div>
        ))}
      </div>

      {shortlist.length > 0 && (
        <>
          <h3 style={{ marginTop: 20 }}>📌 Shortlist</h3>
          {shortlist.map((p, i) => (
            <p key={i}>{p.name} ({p.score})</p>
          ))}
        </>
      )}
    </div>
  );
}
