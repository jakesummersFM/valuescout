"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);
  const [budget, setBudget] = useState(5000000);

  function formatMoney(num: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(num);
  }

  function getScoreColor(score: number) {
    if (score > 85) return "#22c55e";
    if (score > 70) return "#f59e0b";
    return "#ef4444";
  }

  function calculateScore(p: any) {
    let statScore = 50;

    if (p.pos?.includes("GK")) {
      statScore = (p.savePct || 0) * 0.6 + (p.cleanSheets || 0) * 2;
    } else if (p.pos?.includes("CB")) {
      statScore =
        (p.tackles || 0) * 5 +
        (p.interceptions || 0) * 5 +
        (p.aerials || 0) * 3;
    } else if (p.pos?.includes("CM")) {
      statScore =
        (p.passes || 0) * 2 +
        (p.keyPasses || 0) * 4 +
        (p.assists || 0) * 6;
    } else if (p.pos?.includes("ST")) {
      statScore =
        (p.goals || 0) * 8 +
        (p.xg || 0) * 5 +
        (p.shots || 0) * 2;
    }

    const ageScore = 100 - Math.abs(24 - p.age) * 1.5;
    const valueScore = 100 - Math.log10(p.value + 1) * 8;
    const wageScore = 100 - Math.log10(p.wage + 1) * 10;

    return Math.max(
      50,
      Math.min(
        99,
        Math.round(
          statScore * 0.4 +
          ageScore * 0.2 +
          valueScore * 0.2 +
          wageScore * 0.2
        )
      )
    );
  }

  function handleFile(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event: any) => {
      const text = event.target.result;
      const rows = text.split(/\r?\n/).filter((r: string) => r.trim());

      const delimiter = rows[0].includes(";") ? ";" : ",";

      const headers = rows[0]
        .split(delimiter)
        .map((h: string) => h.toLowerCase());

      const getIndex = (names: string[]) =>
        headers.findIndex((h: string) =>
          names.some((n) => h.includes(n))
        );

      const clean = (v: string) => {
        if (!v) return 0;
        let val = v.toLowerCase().replace(/,/g, "");
        if (val.includes("m")) return Number(val.replace("m", "")) * 1e6;
        if (val.includes("k")) return Number(val.replace("k", "")) * 1e3;
        return Number(val.replace(/[^0-9.]/g, ""));
      };

      const parsed = rows.slice(1).map((row: string) => {
        const cols = row.split(delimiter);

        const p: any = {
          name: cols[getIndex(["name"])],
          pos: cols[getIndex(["pos"])],
          age: clean(cols[getIndex(["age"])]),
          wage: clean(cols[getIndex(["wage"])]),
          value: clean(cols[getIndex(["value"])]),

          savePct: clean(cols[getIndex(["save"])]),
          cleanSheets: clean(cols[getIndex(["clean"])]),

          tackles: clean(cols[getIndex(["tackle"])]),
          interceptions: clean(cols[getIndex(["interception"])]),
          aerials: clean(cols[getIndex(["aerial"])]),

          passes: clean(cols[getIndex(["pass"])]),
          keyPasses: clean(cols[getIndex(["key"])]),
          assists: clean(cols[getIndex(["assist"])]),

          goals: clean(cols[getIndex(["goal"])]),
          xg: clean(cols[getIndex(["xg"])]),
          shots: clean(cols[getIndex(["shot"])]),
        };

        p.score = calculateScore(p);
        return p;
      });

      setPlayers(parsed);
    };

    reader.readAsText(file);
  }

  const sorted = [...players]
    .sort((a, b) => b.score - a.score);

  const gems = sorted.filter(
    (p) => p.score > 85 && p.value < 5000000
  );

  const top = sorted[0];

  function share() {
    if (!top) return;
    const text = `💎 I found ${top.name} (${top.pos}) rated ${top.score} on ValueScout for just ${formatMoney(top.value)} 👀`;
    navigator.clipboard.writeText(text);
    alert("Copied for Twitter 🚀");
  }

  return (
    <main style={{
      padding: 30,
      minHeight: "100vh",
      background: "linear-gradient(135deg,#0f172a,#1e1b4b,#312e81)",
      color: "white"
    }}>
      <h1 style={{ fontSize: 36 }}>💎 ValueScout</h1>

      <input type="file" onChange={handleFile} />

      {top && (
        <div style={{
          marginTop: 20,
          padding: 20,
          borderRadius: 15,
          background: "#22c55e",
          color: "black"
        }}>
          🏆 BEST BARGAIN: {top.name} — {top.score}
          <br />
          Value: {formatMoney(top.value)}
          <br />
          <button onClick={share}>Share 🚀</button>
        </div>
      )}

      {gems.length > 0 && (
        <>
          <h2 style={{ marginTop: 30 }}>💎 Hidden Gems</h2>
          {gems.slice(0, 5).map((p, i) => (
            <div key={i}>
              {p.name} — {p.score}
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 30, display: "grid", gap: 15 }}>
        {sorted.slice(0, 20).map((p, i) => (
          <div key={i} style={{
            padding: 20,
            borderRadius: 15,
            background: "#1e293b",
            display: "flex",
            justifyContent: "space-between"
          }}>
            <div>
              <strong>{p.name}</strong> ({p.pos})<br/>
              Age: {p.age}<br/>
              Wage: {formatMoney(p.wage)}<br/>
              Value: {formatMoney(p.value)}
            </div>

            <div style={{
              fontSize: 28,
              color: getScoreColor(p.score)
            }}>
              {p.score}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
