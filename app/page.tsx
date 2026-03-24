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

  // CSV PARSER
  const parseCSV = (text: string): Player[] => {
    const lines = text.split("\n").filter(l => l.trim() !== "");

    const delimiter = lines[0].includes(";") ? ";" : ",";
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

    return lines.slice(1).map(row => {
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
    }).filter(p => p.name && p.pos);
  };

  // SCORING
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

    let parsed = parseCSV(text).map(scorePlayer)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    setPlayers(parsed);
    setLoading(false);
  };

  const best = players[0];
  const hidden = players.slice(0, 8);

  return (
    <div style={{
      padding: 30,
      minHeight: "100vh",
      background: "linear-gradient(180deg, #020617, #020617, #020617, #020617, #020617, #0f172a)",
      color: "white",
      fontFamily: "sans-serif"
    }}>

      <h1 style={{ fontSize: 32, marginBottom: 10 }}>
        💎 FM Value Scout
      </h1>

      <div style={{
        border: "1px dashed #334155",
        padding: 30,
        borderRadius: 12,
        textAlign: "center",
        marginBottom: 20,
        background: "#020617"
      }}>
        <input
          type="file"
          onChange={(e) =>
            e.target.files && handleFile(e.target.files[0])
          }
        />
        <p style={{ marginTop: 10, opacity: 0.6 }}>
          Upload CSV (best results: one position at a time)
        </p>
      </div>

      {loading && <p>⏳ Scouting players...</p>}

      {best && (
        <div style={{
          padding: 20,
          borderRadius: 12,
          background: "linear-gradient(90deg, #022c22, #020617)",
          border: "1px solid #22c55e",
          marginBottom: 20
        }}>
          <h2>🏆 Best Bargain</h2>
          <h3>{best.name}</h3>
          <p>{best.pos} • Age {best.age}</p>
          <p style={{ color: "#22c55e" }}>
            Score {best.score} — {best.role}
          </p>
        </div>
      )}

      <h2 style={{ marginBottom: 10 }}>💎 Hidden Gems</h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))",
        gap: 16
      }}>
        {hidden.map((p, i) => (
          <div key={i} style={{
            background: "#020617",
            border: "1px solid #1e293b",
            borderRadius: 12,
            padding: 16,
            transition: "0.2s"
          }}>
            <h3>{p.name}</h3>
            <p>{p.pos} • Age {p.age}</p>

            <p style={{ color: "#22c55e", fontWeight: "bold" }}>
              {p.score}
            </p>

            <p style={{ opacity: 0.7 }}>{p.role}</p>

            <p style={{ fontSize: 12, opacity: 0.6 }}>
              {p.value || "-"} • {p.wage || "-"}
            </p>

            <button
              onClick={() =>
                setShortlist(prev =>
                  prev.find(s => s.name === p.name)
                    ? prev
                    : [...prev, p]
                )
              }
              style={{
                marginTop: 10,
                background: "#22c55e",
                border: "none",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer"
              }}
            >
              ⭐ Save
            </button>
          </div>
        ))}
      </div>

      {shortlist.length > 0 && (
        <>
          <h2 style={{ marginTop: 30 }}>📌 Shortlist</h2>
          {shortlist.map((p, i) => (
            <p key={i}>
              {p.name} — {p.score}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
