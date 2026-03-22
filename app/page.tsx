"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([];

  function getInsight(p: any) {
    if (p.score > 85 && p.value < 5000000) return "💎 Undervalued Gem";
    if (p.score > 80) return "🔥 Elite Player";
    if (p.age < 21 && p.score > 70) return "📈 High Potential";
    if (p.wage > 100000 && p.score < 60) return "💸 Overpriced";
    return "⚖️ Decent Option";
  }

  function calculateScore(p: any) {
    let score = 0;

    // AGE
    const ageScore =
      p.age <= 21 ? 25 :
      p.age <= 25 ? 20 :
      p.age <= 29 ? 10 : 5;

    // VALUE (lower = better)
    const valueScore =
      p.value < 1000000 ? 25 :
      p.value < 5000000 ? 20 :
      p.value < 20000000 ? 10 : 5;

    // WAGE
    const wageScore =
      p.wage < 10000 ? 25 :
      p.wage < 50000 ? 20 :
      p.wage < 100000 ? 10 : 5;

    // PERFORMANCE (if exists)
    const statScore = p.stat ? Math.min(p.stat, 25) : 10;

    score = ageScore + valueScore + wageScore + statScore;

    return Math.min(score, 100);
  }

  function handleFile(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: any) => {
      const text = event.target.result;
      const rows = text.split("\n").slice(1);

      const parsed = rows.map((row: string) => {
        const cols = row.split(",");

        const player = {
          name: cols[0],
          pos: cols[1],
          age: Number(cols[2]) || 0,
          wage: Number(cols[3]) || 0,
          value: Number(cols[4]) || 0,
          stat: Number(cols[5]) || 10,
        };

        const score = calculateScore(player);

        return {
          ...player,
          score,
          insight: getInsight({ ...player, score }),
        };
      });

      setPlayers(parsed);
    };

    reader.readAsText(file);
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topPlayers = sorted.slice(0, 3);
  const bargains = sorted
    .filter(p => p.value < 5000000 && p.score > 75)
    .slice(0, 5);

  return (
    <div style={{
      minHeight: "100vh",
      padding: "40px",
      color: "white",
      background: "radial-gradient(circle at top, #4c1d95, #1e1b4b, #000)",
      fontFamily: "Arial"
    }}>
      <h1 style={{
        fontSize: 48,
        fontWeight: 800,
        background: "linear-gradient(90deg, #a855f7, #9333ea)",
        WebkitBackgroundClip: "text",
        color: "transparent"
      }}>
        ⚽ ValueScout 💰
      </h1>

      <p style={{ color: "#c4b5fd", marginBottom: 30 }}>
        AI-powered Moneyball scouting for Football Manager
      </p>

      <input type="file" onChange={handleFile} />

      {players.length === 0 && (
        <div style={{ marginTop: 60, color: "#9ca3af" }}>
          Upload your scouting CSV to begin
        </div>
      )}

      {players.length > 0 && (
        <>
          <h2 style={{ marginTop: 40 }}>🔥 Top Players</h2>

          <div style={{ display: "flex", gap: 20 }}>
            {topPlayers.map((p, i) => (
              <div key={i} style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                padding: 20,
                borderRadius: 10
              }}>
                <h3>{p.name}</h3>
                <p>{p.pos}</p>
                <p><strong>{p.score}</strong></p>
                <p>{p.insight}</p>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 40 }}>💎 Best Bargains</h2>

          {bargains.map((p, i) => (
            <div key={i}>
              {p.name} — £{p.value} — {p.insight}
            </div>
          ))}

          <h2 style={{ marginTop: 40 }}>All Players</h2>

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
                  <td>{p.score}</td>
                  <td>{p.insight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}