"use client";
import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);
  const [shortlist, setShortlist] = useState<any[]>([]);
  const [compare, setCompare] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState(40);
  const [pos, setPos] = useState("All");

  // ✅ SAFE NUMBER PARSER
  const safeNum = (val: any) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  // ✅ DISPLAY FIX
  const display = (val: number) => (val === 0 ? "-" : val);

  const handleFile = async (file: File) => {
    setLoading(true);

    const text = await file.text();
    const rows = text.split("\n").slice(1);

    const data = rows.map((r) => {
      const c = r.split(",");

      const p = {
        name: c[0] || "Unknown",
        age: safeNum(c[1]),
        pos: c[2] || "N/A",
        value: safeNum(c[3]),
        wage: safeNum(c[4]),
        s1: safeNum(c[5]),
        s2: safeNum(c[6]),
        s3: safeNum(c[7]),
      };

      // ✅ FIXED SCORING (0–100 RANGE)
      const score =
        (p.s1 * 0.4 + p.s2 * 0.3 + p.s3 * 0.3) / 3;

      const role =
        p.pos === "ST"
          ? "Elite Finisher"
          : p.pos === "CM"
          ? "Creative Playmaker"
          : p.pos === "CB"
          ? "Ball Winning Defender"
          : p.pos === "GK"
          ? "Shot Stopper"
          : "Squad Player";

      return { ...p, score, role };
    });

    setPlayers(data);
    setLoading(false);
  };

  const filtered = players
    .filter((p) => p.age <= age)
    .filter((p) => (pos === "All" ? true : p.pos === pos))
    .sort((a, b) => b.score - a.score);

  const best = filtered[0];
  const gems = filtered.slice(0, 6);

  const color = (s: number) =>
    s > 85 ? "#22c55e" : s > 70 ? "#facc15" : "#f87171";

  const labels = (pos: string) =>
    pos === "ST"
      ? ["Goals", "xG", "Shots"]
      : pos === "CM"
      ? ["Key Passes", "Assists", "Chances"]
      : pos === "CB"
      ? ["Tackles", "Interceptions", "Duels"]
      : pos === "GK"
      ? ["Saves", "Save %", "Clean Sheets"]
      : ["Stat1", "Stat2", "Stat3"];

  const toggleShort = (p: any) =>
    setShortlist((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const toggleCompare = (p: any) =>
    setCompare((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const exportCSV = () => {
    const csv =
      "Name,Score\n" +
      shortlist.map((p) => `${p.name},${p.score.toFixed(0)}`).join("\n");

    const blob = new Blob([csv]);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "shortlist.csv";
    a.click();
  };

  return (
    <main
      style={{
        padding: 20,
        background: "linear-gradient(180deg,#020617,#0f172a)",
        color: "white",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 28 }}>💎 FM Value Scout</h1>

      {/* UPLOAD */}
      <div
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0]);
        }}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border: "2px dashed #334155",
          padding: 20,
          borderRadius: 12,
          marginTop: 15,
          textAlign: "center",
        }}
      >
        Drag & Drop CSV
        <br />
        <input
          type="file"
          onChange={(e) => handleFile(e.target.files![0])}
        />
      </div>

      {loading && (
        <p style={{ marginTop: 10 }}>⚡ Processing data...</p>
      )}

      {/* FILTERS */}
      <div style={{ marginTop: 20 }}>
        Age ≤ {age}
        <input
          type="range"
          min="16"
          max="40"
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
        />

        <select onChange={(e) => setPos(e.target.value)}>
          <option>All</option>
          <option>ST</option>
          <option>CM</option>
          <option>CB</option>
          <option>GK</option>
        </select>
      </div>

      {/* BEST BARGAIN */}
      {best && (
        <div
          style={{
            marginTop: 20,
            background: "#020617",
            padding: 20,
            borderRadius: 12,
            border: "2px solid #22c55e",
            boxShadow: "0 0 10px #22c55e55",
          }}
        >
          🏆 Best Bargain
          <h2>{best.name}</h2>
          <p style={{ color: color(best.score) }}>
            {best.score.toFixed(0)} — {best.role}
          </p>
        </div>
      )}

      {/* HIDDEN GEMS */}
      <div style={{ marginTop: 20 }}>
        💎 Hidden Gems
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {gems.map((p, i) => (
            <span
              key={i}
              style={{
                background: "#1e293b",
                padding: "6px 10px",
                borderRadius: 20,
              }}
            >
              {p.name} ({p.score.toFixed(0)})
            </span>
          ))}
        </div>
      </div>

      {/* EXPORT */}
      {shortlist.length > 0 && (
        <button
          onClick={exportCSV}
          style={{
            marginTop: 10,
            background: "#1e293b",
            color: "white",
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
          }}
        >
          ⬇️ Export Shortlist
        </button>
      )}

      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill,minmax(240px,1fr))",
          gap: 15,
          marginTop: 20,
        }}
      >
        {filtered.map((p, i) => (
          <div
            key={i}
            style={{
              background: "#020617",
              padding: 15,
              borderRadius: 12,
              border:
                p === best
                  ? "2px solid #22c55e"
                  : "1px solid #1e293b",
              boxShadow:
                p === best ? "0 0 10px #22c55e55" : "none",
            }}
          >
            <h3>
              {p.name}
              <span
                style={{
                  float: "right",
                  color: color(p.score),
                }}
              >
                {p.score.toFixed(0)}
              </span>
            </h3>

            <p>
              {p.pos} • Age {display(p.age)}
            </p>

            {labels(p.pos).map((l, idx) => {
              const val = [p.s1, p.s2, p.s3][idx];
              return (
                <div key={idx}>
                  <small>{l}</small>
                  <div
                    style={{
                      height: 6,
                      background: "#334155",
                    }}
                  >
                    <div
                      style={{
                        width: `${val}%`,
                        height: 6,
                        background: "#22c55e",
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <p style={{ fontSize: 12 }}>{p.role}</p>

            <p style={{ fontSize: 12 }}>
              💰 £{display(p.value)} | £{display(p.wage)}
            </p>

            <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
              <button onClick={() => toggleShort(p)}>⭐</button>
              <button onClick={() => toggleCompare(p)}>⚖️</button>
              <button
                style={{
                  background: "#22c55e",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: 6,
                }}
              >
                + Sign
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* COMPARE */}
      {compare.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h2>⚖️ Compare</h2>
          {compare.map((p, i) => (
            <div key={i}>
              {p.name} — {p.score.toFixed(0)}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
