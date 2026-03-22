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

  function calculateScore(p: any) {
    const ageScore = 100 - Math.abs(24 - p.age) * 1.5;
    const valueScore = 100 - Math.log10(p.value + 1) * 8;
    const wageScore = 100 - Math.log10(p.wage + 1) * 10;

    let score =
      ageScore * 0.4 +
      valueScore * 0.3 +
      wageScore * 0.3;

    if (p.pos === "ST") score += 2;
    if (p.pos === "CB") score += 1;
    if (p.pos === "GK") score -= 2;

    return Math.max(50, Math.min(99, Math.round(score)));
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

      const rows = text.split(/\r?\n/).filter((r: string) => r.trim() !== "");
      if (rows.length < 2) return;

      const delimiter = rows[0].includes(";") ? ";" : ",";

      const headers = rows[0]
        .split(delimiter)
        .map((h: string) => h.trim().toLowerCase());

      // 🔥 STRONG HEADER MATCHING
      const getIndex = (keywords: string[]) =>
        headers.findIndex((h: string) =>
          keywords.some((k) => h.includes(k))
        );

      const nameIndex = getIndex(["name"]);
      const posIndex = getIndex(["pos", "position"]);
      const ageIndex = getIndex(["age"]);
      const wageIndex = getIndex(["wage", "salary", "weekly"]);
      const valueIndex = getIndex(["value", "price", "transfer"]);

      // 🔥 SMART NUMBER CLEANER
      const cleanNumber = (val: string) => {
        if (!val) return 0;

        let v = val.toLowerCase().replace(/,/g, "").trim();

        if (v.includes("m")) return Number(v.replace("m", "")) * 1000000;
        if (v.includes("k")) return Number(v.replace("k", "")) * 1000;

        return Number(v.replace(/[^0-9.]/g, ""));
      };

      const parsed = rows.slice(1).map((row: string) => {
        const cols = row.split(delimiter);

        const p = {
          name: cols[nameIndex]?.trim() || "Unknown",
          pos: cols[posIndex]?.trim() || "N/A",
          age: cleanNumber(cols[ageIndex]),
          wage: cleanNumber(cols[wageIndex]),
          value: cleanNumber(cols[valueIndex]),
        };

        if (!p.name || isNaN(p.age)) return null;

        const score = calculateScore(p);

        return {
          ...p,
          score,
          insight: getInsight({ ...p, score }),
        };
      });

      setPlayers(parsed.filter((p: any) => p !== null));
    };

    reader.readAsText(file);
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
        background:
          "linear-gradient(135deg, #0f172a, #1e293b, #312e81)",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>
        ValueScout 💎
      </h1>

      <input type="file" onChange={handleFile} />

      <div style={{ marginTop: 20 }}>
        <label>Budget: {formatMoney(budget)}</label>
        <input
          type="range"
          min="1000000"
          max="100000000"
          step="1000000"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
        />

        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        >
          <option value="ALL">All</option>
          <option value="ST">ST</option>
          <option value="CM">CM</option>
          <option value="CB">CB</option>
          <option value="RW">RW</option>
          <option value="GK">GK</option>
        </select>
      </div>

      {sorted.length > 0 && (
        <>
          <h2 style={{ marginTop: 30 }}>Top Players</h2>

          {sorted.slice(0, 10).map((p, i) => (
            <div
              key={i}
              style={{
                padding: 15,
                marginTop: 10,
                borderRadius: 10,
                background: "#1e293b",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div>
                <strong>{p.name}</strong> ({p.pos})
                <br />
                Age: {p.age}
                <br />
                Wage: {formatMoney(p.wage)}
                <br />
                Value: {formatMoney(p.value)}
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24 }}>{p.score}</div>
                <div>{p.insight}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
