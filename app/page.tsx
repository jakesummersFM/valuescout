"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);

  function formatMoney(num: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: "compact",
    }).format(num);
  }

  function getScoreColor(score: number) {
    if (score >= 85) return "#22c55e";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
  }

  function getInsight(p: any) {
    if (p.pos.includes("ST") && p.goals > 15)
      return "Elite Finisher";
    if (p.pos.includes("CM") && p.keyPasses > 40)
      return "Creative Playmaker";
    if (p.pos.includes("CB") && p.tackles > 25)
      return "Ball Winning Defender";
    if (p.pos.includes("GK") && p.savePct > 75)
      return "Shot Stopper";
    return "Squad Player";
  }

  function calculateScore(p: any) {
    let statScore = 50;

    if (p.pos.includes("GK")) {
      statScore = p.savePct * 0.7 + p.cleanSheets * 2;
    } else if (p.pos.includes("CB")) {
      statScore =
        p.tackles * 4 +
        p.interceptions * 4 +
        p.aerials * 3;
    } else if (p.pos.includes("CM")) {
      statScore =
        p.passes * 1.5 +
        p.keyPasses * 4 +
        p.assists * 5;
    } else if (p.pos.includes("ST")) {
      statScore =
        p.goals * 7 +
        p.xg * 4 +
        p.shots * 1.5;
    }

    const ageScore = 100 - Math.abs(24 - p.age) * 1.2;
    const valueScore = 100 - Math.log10(p.value + 1) * 7;
    const wageScore = 100 - Math.log10(p.wage + 1) * 9;

    return Math.max(
      60,
      Math.min(
        99,
        Math.round(
          statScore * 0.5 +
            ageScore * 0.2 +
            valueScore * 0.15 +
            wageScore * 0.15
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
        p.insight = getInsight(p);

        return p;
      });

      setPlayers(parsed);
    };

    reader.readAsText(file);
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const gems = sorted.filter(
    (p) => p.score > 85 && p.value < 5000000
  );

  return (
    <main style={{
      padding: 30,
      background: "#0f172a",
      color: "white",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: 32 }}>ValueScout</h1>

      <input type="file" onChange={handleFile} />

      {top && (
        <div style={{
          marginTop: 20,
          padding: 20,
          background: "#1e293b",
          borderLeft: "5px solid #22c55e"
        }}>
          <h2>🏆 Best Bargain</h2>
          {top.name} ({top.pos}) — {top.score}
          <br />
          {formatMoney(top.value)}
        </div>
      )}

      {gems.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>💎 Hidden Gems</h2>
          {gems.map((p, i) => (
            <div key={i}>
              {p.name} — {p.score}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        {sorted.slice(0, 15).map((p, i) => (
          <div key={i} style={{
            padding: 15,
            marginBottom: 10,
            background: "#1e293b",
            borderRadius: 8
          }}>
            <strong>{p.name}</strong> ({p.pos}) — {p.age}
            <br />

            {p.pos.includes("ST") && (
              <>Goals: {p.goals} | xG: {p.xg}</>
            )}
            {p.pos.includes("CM") && (
              <>Key Passes: {p.keyPasses} | Assists: {p.assists}</>
            )}
            {p.pos.includes("CB") && (
              <>Tackles: {p.tackles} | Interceptions: {p.interceptions}</>
            )}
            {p.pos.includes("GK") && (
              <>Save %: {p.savePct} | CS: {p.cleanSheets}</>
            )}

            <br />
            💰 {formatMoney(p.value)} | 🧾 {formatMoney(p.wage)}
            <br />
            <span style={{ color: getScoreColor(p.score) }}>
              {p.score}
            </span>{" "}
            — {p.insight}
          </div>
        ))}
      </div>
    </main>
  );
}
