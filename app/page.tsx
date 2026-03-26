"use client"
import React, { useState } from "react"
import Papa from "papaparse"
// ---------------- SAFE ----------------
const safe = (val: any): number => {
  const num = Number(val)
  return isNaN(num) ? 0 : num
}
// ---------------- CLEAN ----------------
const cleanData = (data: any[]): any[] => {
  return data.filter(row => row["Name"] && row["Name"] !== "")
}
// ---------------- POSITION ----------------
const detectPosition = (row: any): string => {
  const pos = row["Position"] || ""
  if (pos.includes("GK")) return "GK"
  if (pos.match(/CB|LB|RB/)) return "DEF"
  if (pos.match(/CM|AM|DM/)) return "MID"
  if (pos.match(/ST|CF/)) return "ATT"
  return "UNKNOWN"
}
// ---------------- SCORING ----------------
const calculateScore = (row: any, type: string): number => {
  const age = safe(row["Age"])
  const value = safe(row["Value"])
  let performance = 0
  if (type === "ATT") {
    performance =
      safe(row["Goals"]) * 4 +
      safe(row["xG"]) * 3 +
      safe(row["Shots"]) * 0.5 +
      safe(row["Shots on Target"]) * 1
  }
  if (type === "MID") {
    performance =
      safe(row["Assists"]) * 4 +
      safe(row["Key Passes"]) * 2 +
      safe(row["Progressive Passes"]) * 1.5 +
      safe(row["Pass Completion %"]) * 0.3
  }
  if (type === "DEF") {
    performance =
      safe(row["Tackles"]) * 2 +
      safe(row["Interceptions"]) * 2 +
      safe(row["Clearances"]) * 1.5 +
      safe(row["Aerial Duels Won"]) * 1.5
  }
  if (type === "GK") {
    performance =
      safe(row["Save %"]) * 2 +
      safe(row["Saves"]) * 1.5 +
      safe(row["Clean Sheets"]) * 3
  }
  const ageFactor = age <= 24 ? 1.1 : age <= 28 ? 1 : 0.9
  const valueFactor = value > 0 ? 1 / Math.log(value + 10) : 1
  return performance * ageFactor * valueFactor
}
// ---------------- PROCESS ----------------
const processPlayers = (data: any[]) => {
  const cleaned = cleanData(data)
  const players = cleaned.map((row: any) => {
    const type = detectPosition(row)
    const rawScore = calculateScore(row, type)
    const value = safe(row["Value"])
    return {
      name: row["Name"] || "Unknown",
      age: safe(row["Age"]),
      position: row["Position"] || "N/A",
      type,
      rawScore,
      value,
      stats: row
    }
  })
  const maxScore = players.length
    ? Math.max(...players.map(p => p.rawScore))
    : 1
  const scored = players.map(p => ({
    ...p,
    score: Math.round((p.rawScore / maxScore) * 100)
  }))
  // 🏆 BEST BARGAIN = highest score relative to value
  const bestBargain = [...scored].sort((a, b) => {
    const aRatio = a.score / (a.value || 1)
    const bRatio = b.score / (b.value || 1)
    return bRatio - aRatio
  })[0]?.name
  return scored.map(p => ({
    ...p,
    isBestBargain: p.name === bestBargain
  }))
}
// ---------------- STAT BAR ----------------
const StatBar = ({ label, value }: { label: string; value: number }) => (
  <div style={{ marginBottom: "6px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#aaa" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div style={{ background: "#333", height: "6px", borderRadius: "4px" }}>
      <div
        style={{
          width: `${Math.min(value, 100)}%`,
          background: "#4ade80",
          height: "6px",
          borderRadius: "4px"
        }}
      />
    </div>
  </div>
)
// ---------------- PLAYER CARD ----------------
const PlayerCard = ({ player }: { player: any }) => {
  const s = player.stats
  return (
    <div style={{
      background: player.isBestBargain ? "#065f46" : "#1e293b",
      padding: "12px",
      borderRadius: "12px",
      width: "220px",
      color: "white",
      border: player.isBestBargain ? "2px solid gold" : "none"
    }}>
      {player.isBestBargain && (
        <div style={{ color: "gold", fontSize: "12px" }}>
          🏆 BEST BARGAIN
        </div>
      )}
      <h3>{player.name}</h3>
      <p style={{ fontSize: "12px", color: "#aaa" }}>
        {player.position} • Age {player.age}
      </p>
      <p style={{ color: "#4ade80", fontWeight: "bold" }}>
        {player.score} — {player.type}
      </p>
      <div style={{ marginTop: "10px" }}>
        {player.type === "ATT" && (
          <>
            <StatBar label="Goals" value={safe(s["Goals"]) * 5} />
            <StatBar label="xG" value={safe(s["xG"]) * 5} />
            <StatBar label="Shots" value={safe(s["Shots"])} />
          </>
        )}
        {player.type === "MID" && (
          <>
            <StatBar label="Key Passes" value={safe(s["Key Passes"])} />
            <StatBar label="Progressive" value={safe(s["Progressive Passes"])} />
            <StatBar label="Pass %" value={safe(s["Pass Completion %"])} />
          </>
        )}
        {player.type === "DEF" && (
          <>
            <StatBar label="Tackles" value={safe(s["Tackles"])} />
            <StatBar label="Interceptions" value={safe(s["Interceptions"])} />
            <StatBar label="Aerials" value={safe(s["Aerial Duels Won"])} />
          </>
        )}
        {player.type === "GK" && (
          <>
            <StatBar label="Save %" value={safe(s["Save %"])} />
            <StatBar label="Saves" value={safe(s["Saves"])} />
            <StatBar label="Clean Sheets" value={safe(s["Clean Sheets"]) * 5} />
          </>
        )}
      </div>
    </div>
  )
}
// ---------------- MAIN APP ----------------
export default function Page() {
  const [players, setPlayers] = useState<any[]>([])
  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const processed = processPlayers(results.data)
        setPlayers(processed)
      }
    })
  }
  return (
    <div style={{ padding: "20px", background: "#0f172a", minHeight: "100vh" }}>
      <h1 style={{ color: "white" }}>FM Value Scout</h1>
      <input
        type="file"
        accept=".csv"
        onChange={(e: any) => handleFile(e.target.files[0])}
        style={{ marginBottom: "20px" }}
      />
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        {players.map((p, i) => (
          <PlayerCard key={i} player={p} />
        ))}
      </div>
    </div>
  )
}
