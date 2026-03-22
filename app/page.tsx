"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);

  function calculateScore(p: any) {
    let score = 50;

    // Core stats (example logic)
    score += (100 - p.age);
    score += (10000000 - p.value) / 200000;
    score += (100000 - p.wage) / 2000;

    // Position weighting
    if (p.pos === "ST") score += 5;
    if (p.pos === "CB") score += 3;
    if (p.pos === "GK") score -= 2;

    return Math.max(1, Math.min(100, Math.round(score)));
  }

  function getInsight(p: any) {
    if (p.score > 90 && p.value < 3000000) return "💎 Undervalued Gem";
    if (p.score > 85) return "🔥 Elite Player";
    if (p.score > 75 && p.value > 50000000) return "⭐ Elite (Expensive)";
    if (p.age < 21 && p.score > 70) return "📈 High Potential";
    if (p.wage > 100000 && p.score < 65) return "💸 Overpriced";
    return "⚖️ Decent Option";
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

          const p = {
            name: cols[0],
            pos: cols[1],
            age: Number(cols[2]),
            wage: Number(cols[3]),
            value: Number(cols[4]),
          };

          const score = calculateScore(p);

          return {
            ...p,
            score,
            insight: getInsight({ ...p, score }),
          };
        })
        .filter((p: any) => p.name);

      setPlayers(parsed);
    };

    reader.readAsText(file);
  }

  function shareToTwitter() {
    if (players.length === 0) return;

    const top = [...players]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const text = `I just found some insane hidden gems using ValueScout 💎

🔥 ${top[0]?.name} (${top[0]?.score}) - £${top[0]?.value}
🔥 ${top[1]?.name} (${top[1]?.score}) - £${top[1]?.value}
🔥 ${top[2]?.name} (${top[2]?.score}) - £${top[2]?.value}

Try it yourself 👇
https://valuescout-6g6v.vercel.app/`;

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <main style={{ padding: 30, color: "white", background: "#0f172a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 32 }}>ValueScout 💰</h1>
      <p>AI-powered Moneyball scouting</p>

      <input type="file" onChange={handleFile} />

      <br /><br />

      <button
        onClick={shareToTwitter}
        style={{
          padding: "10px 20px",
          background: "#1DA1F2",
          border: "none",
          borderRadius: 8,
          color: "white",
          cursor: "pointer",
        }}
      >
        🐦 Share Results
      </button>

      {players.length > 0 && (
        <>
          <h2 style={{ marginTop: 40 }}>🔥 Top Players</h2>

          {sorted.slice(0, 3).map((p, i) => (
            <div key={i}>
              {p.name} — {p.pos} — {p.score} — {p.insight}
            </div>
          ))}

          <h2 style={{ marginTop: 40 }}>💰 Best Bargains</h2>

          {sorted
            .filter((p) => p.value < 5000000)
            .slice(0, 5)
            .map((p, i) => (
              <div key={i}>
                {p.name} — £{p.value} — {p.insight}
              </div>
            ))}

          <h2 style={{ marginTop: 40 }}>🎯 Best Signing Under £5M</h2>

          {sorted
            .filter((p) => p.value < 5000000)
            .slice(0, 1)
            .map((p, i) => (
              <div key={i}>
                {p.name} — {p.pos} — {p.score} — {p.insight}
              </div>
            ))}

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
                  <td>£{p.wage}</td>
                  <td>£{p.value}</td>
                  <td
                    style={{
                      fontWeight: "bold",
                      color:
                        p.score > 85 ? "#22c55e" :
                        p.score > 70 ? "#eab308" :
                        "#ef4444"
                    }}
                  >
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