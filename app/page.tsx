"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);
  const [budget, setBudget] = useState(5000000);
  const [position, setPosition] = useState("ALL");

  // 💰 Format money
  function formatMoney(num: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(num);
  }

  // 🧠 ELITE SCORING (FIXED DISTRIBUTION)
  function calculateScore(p: any) {
    const ageScore = 100 - Math.abs(24 - p.age) * 4;
    const valueScore = 100 - Math.log10(p.value + 1) * 20;
    const wageScore = 100 - Math.log10(p.wage + 1) * 25;

    let score =
      ageScore * 0.4 +
      valueScore * 0.3 +
      wageScore * 0.3;

    if (p.pos === "ST") score += 2;
    if (p.pos === "CB") score += 1;
    if (p.pos === "GK") score -= 2;

    return Math.max(1, Math.min(99, Math.round(score)));
  }

  // 🔥 INSIGHTS
  function getInsight(p: any) {
    if (p.score > 90 && p.value < 3000000) return "💎 Hidden Gem";
    if (p.score > 85 && p.value < 10000000) return "💰 Best Value";
    if (p.wage < 10000 && p.score > 80) return "🧾 Wage Steal";
    if (p.age < 21 && p.score > 75) return "📈 Future Star";
    if (p.score > 85) return "🔥 Elite Player";
    if (p.wage > 150000 && p.score < 65) return "💸 Overpriced";
    return "⚖️ Squad Option";
  }

  // 📂 CLEAN CSV PARSER
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

  // 🐦 SHARE
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

  // 🎯 FILTERS
  const filtered = players.filter((p) => {
    return (position === "ALL" || p.pos === position) && p.value <= budget;
  });

  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <main style={{ padding: 30, background: "#0f172a", color: "white", minHeight: "100vh" }}>
      <h1>ValueScout 💰</h1>
      <p>Elite Moneyball Analysis</p>

      <input type="file" onChange={handleFile} />

      {/* 🎯 FILTERS */}
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
          style={{ marginTop: 10 }}
        >
          <option value="ALL">All Positions</option>
          <option value="ST">ST</option>
          <option value="CM">CM</option>
          <option value="CB">CB</option>
          <option value="RW">RW</option>
          <option value="GK">GK</option>
        </select>
      </div>

      <button onClick={shareToTwitter} style={{ marginTop: 20 }}>
        🐦 Share Results
      </button>

      {/* 🔥 TOP CARDS */}
      {sorted.length > 0 && (
        <>
          <h2>🔥 Top Targets</h2>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {sorted.slice(0, 5).map((p, i) => (
              <div
                key={i}
                style={{
                  padding: 15,
                  borderRadius: 10,
                  background: "#1e293b",
                  minWidth: 200,
                }}
              >
                <h3>{p.name}</h3>
                <p>{p.pos}</p>
                <p style={{ fontSize: 22, fontWeight: "bold" }}>{p.score}</p>
                <p>{p.insight}</p>
              </div>
            ))}
          </div>

          {/* 💎 BEST VALUE */}
          <h3 style={{ marginTop: 30 }}>💎 Best Value Pick</h3>
          {sorted[0] && (
            <div>
              {sorted[0].name} — {formatMoney(sorted[0].value)} — {sorted[0].score}
            </div>
          )}

          {/* 📊 TABLE */}
          <h2 style={{ marginTop: 40 }}>📊 All Players</h2>

          <table style={{ width: "100%", marginTop: 20 }}>
            <thead>
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
              {sorted.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.pos}</td>
                  <td>{p.age}</td>
                  <td>{formatMoney(p.wage)}</td>
                  <td>{formatMoney(p.value)}</td>
                  <td style={{
                    color:
                      p.score > 85 ? "#22c55e" :
                      p.score > 70 ? "#eab308" :
                      "#ef4444"
                  }}>
                    {p.score}
                  </td>
                  <td>{p.insight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
