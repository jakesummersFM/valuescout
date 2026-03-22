"use client";

import { useState } from "react";

export default function Home() {
  const [players, setPlayers] = useState<any[]>([]);

  // 💰 FORMAT MONEY
  function formatMoney(num: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: "compact",
    }).format(num || 0);
  }

  // 🎨 SCORE COLOR
  function getScoreColor(score: number) {
    if (score >= 85) return "#22c55e";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
  }

  // 🧠 INSIGHT ENGINE
  function getInsight(p: any) {
    if (p.pos.includes("ST") && p.goals > 15) return "Elite Finisher";
    if (p.pos.includes("CM") && p.keyPasses > 40) return "Creative Playmaker";
    if (p.pos.includes("CB") && p.tackles > 25) return "Ball Winning Defender";
    if (p.pos.includes("GK") && p.savePct > 75) return "Shot Stopper";
    return "Squad Player";
  }

  // 🧮 SCORING SYSTEM (BALANCED)
  function calculateScore(p: any) {
    let statScore = 50;

    if (p.pos.includes("GK")) {
      statScore = p.savePct * 0.7 + p.cleanSheets * 2;
    } else if (p.pos.includes("CB")) {
      statScore = p.tackles * 3 + p.interceptions * 3 + p.aerials * 2;
    } else if (p.pos.includes("CM")) {
      statScore = p.keyPasses * 3 + p.assists * 5;
    } else if (p.pos.includes("ST")) {
      statScore = p.goals * 6 + p.xg * 3 + p.shots * 1.2;
    }

    const ageScore = 100 - Math.abs(24 - p.age) * 1.5;
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

  // 📊 STAT BAR COMPONENT
  function Stat({ label, value, max }: any) {
    const percent = Math.min(100, (value / max) * 100);

    return (
      <div>
        <div style={{
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between"
        }}>
          <span>{label}</span>
          <span>{value}</span>
        </div>

        <div style={{
          height: 6,
          background: "#1f2937",
          borderRadius: 4,
          overflow: "hidden"
        }}>
          <div style={{
            width: percent + "%",
            height: "100%",
            background:
              percent > 70 ? "#22c55e" :
              percent > 40 ? "#f59e0b" :
              "#ef4444"
          }} />
        </div>
      </div>
    );
  }

  // 📂 FILE PARSER (FIXED)
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
  const gems = sorted.filter(p => p.score > 85 && p.value < 5000000);

  return (
    <main style={{
      padding: 30,
      background: "#0b1220",
      color: "white",
      minHeight: "100vh",
      fontFamily: "system-ui"
    }}>
      <h1 style={{ fontSize: 34, marginBottom: 20 }}>
        💎 ValueScout
      </h1>

      <input type="file" onChange={handleFile} />

      {/* HERO */}
      {top && (
        <div style={{
          marginTop: 25,
          padding: 20,
          borderRadius: 12,
          background: "#111827",
          border: "1px solid #1f2937"
        }}>
          <h2>🏆 Best Bargain</h2>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>
            {top.name} ({top.pos})
          </div>
          <div>
            💰 {formatMoney(top.value)} | 🧾 {formatMoney(top.wage)}
          </div>
          <div style={{ color: "#22c55e" }}>
            {top.score} — {top.insight}
          </div>
        </div>
      )}

      {/* GEMS */}
      {gems.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h2>💎 Hidden Gems</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {gems.slice(0, 6).map((p, i) => (
              <div key={i} style={{
                padding: "6px 10px",
                background: "#1f2937",
                borderRadius: 999,
                fontSize: 12
              }}>
                {p.name} ({p.score})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRID */}
      <div style={{
        marginTop: 30,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 18
      }}>
        {sorted.slice(0, 20).map((p, i) => (
          <div key={i} style={{
            background: "#111827",
            borderRadius: 12,
            padding: 18,
            position: "relative",
            border: "1px solid #1f2937"
          }}>
            {/* SCORE */}
            <div style={{
              position: "absolute",
              top: 12,
              right: 12,
              fontSize: 18,
              fontWeight: "bold",
              color: getScoreColor(p.score)
            }}>
              {p.score}
            </div>

            <div style={{ fontSize: 18, fontWeight: "bold" }}>
              {p.name}
            </div>

            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {p.pos} • Age {p.age}
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {p.pos.includes("ST") && (
                <>
                  <Stat label="Goals" value={p.goals} max={25} />
                  <Stat label="xG" value={p.xg} max={20} />
                  <Stat label="Shots" value={p.shots} max={100} />
                </>
              )}

              {p.pos.includes("CM") && (
                <>
                  <Stat label="Key Passes" value={p.keyPasses} max={80} />
                  <Stat label="Assists" value={p.assists} max={20} />
                </>
              )}

              {p.pos.includes("CB") && (
                <>
                  <Stat label="Tackles" value={p.tackles} max={40} />
                  <Stat label="Interceptions" value={p.interceptions} max={40} />
                </>
              )}

              {p.pos.includes("GK") && (
                <>
                  <Stat label="Save %" value={p.savePct} max={100} />
                  <Stat label="Clean Sheets" value={p.cleanSheets} max={25} />
                </>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 13 }}>
              💰 {formatMoney(p.value)} <br />
              🧾 {formatMoney(p.wage)}
            </div>

            <div style={{
              marginTop: 10,
              fontSize: 13,
              color: "#22c55e"
            }}>
              {p.insight}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
