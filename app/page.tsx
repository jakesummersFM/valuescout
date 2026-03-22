"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);
  const [budget, setBudget] = useState(5000000);
  const [position, setPosition] = useState("ALL");

  function formatMoney(num: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(num);
  }

  // 🧠 BALANCED SCORING (FIXED AGAIN)
  function calculateScore(p: any) {
    // Age (peak 24)
    const ageScore = 100 - Math.abs(24 - p.age) * 2;

    // Value (scaled softer)
    const valueScore = 100 - Math.log10(p.value + 1) * 10;

    // Wage (scaled softer)
    const wageScore = 100 - Math.log10(p.wage + 1) * 12;

    let score =
      ageScore * 0.4 +
      valueScore * 0.3 +
      wageScore * 0.3;

    // Position tweaks
    if (p.pos === "ST") score += 2;
    if (p.pos === "CB") score += 1;
    if (p.pos === "GK") score -= 2;

    return Math.max(40, Math.min(99, Math.round(score)));
  }

  function getInsight(p: any) {
    if (p.score > 90 && p.value < 3000000) return "💎 Hidden Gem";
    if (p.score > 85 && p.value < 10000000) return "💰 Best Value";
    if (p.wage < 10000 && p.score > 80) return "🧾 Wage Steal";
    if (p.age < 21 && p.score > 75) return "📈 Future Star";
    if (p.score > 85) return "🔥 Elite Player";
    if (p.wage > 150000 && p.score < 65) return "💸 Overpriced";
    return "⚖️ Squad Option";
  }

  function handleFile(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event: any) => {
      const text = event.target.result;
      const rows = text.split("\n").slice(1);

      const parsed = rows
        .map((row: string) => {
          const cols = row.split(",");
          if (cols.length < 5) return null;

          const age = Number(cols[2]);
          const wage = Number(cols[3]);
          const value = Number(cols[4]);

          if (isNaN(age) || isNaN(wage) || isNaN(value)) return null;

          const p = {
            name: cols[0],
            pos: cols[1],
            age,
            wage,
            value,
          };

          const score = calculateScore(p);

          return {
            ...p,
            score,
            insight: getInsight({ ...p, score }),
          };
        })
        .filter((p: any) => p !== null);

      setPlayers(parsed);
    };

    reader.readAsText(file);
  }

  function shareToTwitter() {
    if (players.length === 0) return;

    const top = [...players]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const text = `ValueScout found these gems 💎

🔥 ${top[0]?.name} (${top[0]?.score})
🔥 ${top[1]?.name} (${top[1]?.score})
🔥 ${top[2]?.name} (${top[2]?.score})

Try it 👇
https://valuescout-6g6v.vercel.app/`;

    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
  }

  const filtered = players.filter((p) => {
    return (position === "ALL" || p.pos === position) && p.value <= budget;
  });

  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <main
      style={{
        padding: 30,
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "white",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 36, fontWeight: "bold" }}>ValueScout 💎</h1>
      <p style={{ opacity: 0.7 }}>Elite Moneyball Analysis</p>

      <input type="file" onChange={handleFile} style={{ marginTop: 20 }} />

      {/* FILTERS */}
      <div style={{ marginTop: 20 }}>
        <label>Budget: {formatMoney(budget)}</label>
        <input
          type="range"
          min="1000000"
          max="100000000"
          step="1000000"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          style={{ width: "100%" }}
        />

        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 6,
            background: "#1e293b",
            color: "white",
            border: "none",
          }}
        >
          <option value="ALL">All Positions</option>
          <option value="ST">ST</option>
          <option value="CM">CM</option>
          <option value="CB">CB</option>
          <option value="RW">RW</option>
          <option value="GK">GK</option>
        </select>
      </div>

      <button
        onClick={shareToTwitter}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          background: "#38bdf8",
          color: "#0f172a",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🐦 Share Results
      </button>

      {/* RESULTS */}
      {sorted.length > 0 && (
        <>
          <h2 style={{ marginTop: 40 }}>🔥 Top Targets</h2>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {sorted.slice(0, 5).map((p, i) => {
              const initials = p.name
                .split(" ")
                .map((n: string) => n[0])
                .join("");

              const scoreColor =
                p.score > 85 ? "#22c55e" :
                p.score > 70 ? "#eab308" :
                "#ef4444";

              return (
                <div
                  key={i}
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(10px)",
                    minWidth: 220,
                  }}
                >
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: "#38bdf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      marginBottom: 10,
                    }}
                  >
                    {initials}
                  </div>

                  <h3>{p.name}</h3>
                  <p style={{ opacity: 0.7 }}>{p.pos}</p>

                  <div
                    style={{
                      marginTop: 10,
                      padding: "5px 10px",
                      borderRadius: 20,
                      background: scoreColor,
                      color: "black",
                      display: "inline-block",
                      fontWeight: "bold",
                    }}
                  >
                    {p.score}
                  </div>

                  <p style={{ marginTop: 10 }}>{p.insight}</p>
                </div>
              );
            })}
          </div>

          <h3 style={{ marginTop: 30 }}>💎 Best Value Pick</h3>
          {sorted[0] && (
            <div style={{ opacity: 0.8 }}>
              {sorted[0].name} — {formatMoney(sorted[0].value)} — {sorted[0].score}
            </div>
          )}

          <h2 style={{ marginTop: 40 }}>📊 All Players</h2>

          <table style={{ width: "100%", marginTop: 20 }}>
            <thead style={{ opacity: 0.7 }}>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Age</th>
                <th>Wage</th>
                <th>Value</th>
                <th>Score</th>
                <th>Insight</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const scoreColor =
                  p.score > 85 ? "#22c55e" :
                  p.score > 70 ? "#eab308" :
                  "#ef4444";

                return (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.pos}</td>
                    <td>{p.age}</td>
                    <td>{formatMoney(p.wage)}</td>
                    <td>{formatMoney(p.value)}</td>
                    <td style={{ color: scoreColor, fontWeight: "bold" }}>
                      {p.score}
                    </td>
                    <td>{p.insight}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
