"use client"

import React, { useState } from "react"
import Papa from "papaparse"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"

// ✅ FIX TYPE ERRORS
type Player = {
  Name: string
  Value: number
  Wage: number
  score: number
  tag: string
  [key: string]: any
}

export default function Page() {
  const [players, setPlayers] = useState<Player[]>([])
  const [position, setPosition] = useState("ATT")

  const num = (v: any) => {
    const n = Number(v)
    return isNaN(n) ? 0 : n
  }

  const normalize = (val: number, min: number, max: number) => {
    if (max === min) return 0
    return (val - min) / (max - min)
  }

  const calculateScores = (data: any[]): Player[] => {
    if (!data || data.length === 0) return []

    const clean = data.filter(p => p.Name)

    const get = (key: string) => clean.map(p => num(p[key]))

    let metrics: any = {}

    if (position === "ATT") {
      metrics = {
        goals: get("Goals"),
        xg: get("xG"),
        shots: get("Shots"),
        conv: clean.map(p => num(p["Goals"]) / (num(p["Shots"]) || 1))
      }
    }

    if (position === "MID") {
      metrics = {
        key: get("Key Passes"),
        prog: get("Progressive Passes"),
        pass: get("Pass %"),
        ast: get("Assists")
      }
    }

    if (position === "DEF") {
      metrics = {
        tkl: get("Tackles"),
        int: get("Interceptions"),
        clr: get("Clearances"),
        aer: get("Aerials Won")
      }
    }

    if (position === "GK") {
      metrics = {
        save: get("Save %"),
        saves: get("Saves"),
        cs: get("Clean Sheets")
      }
    }

    const mins: any = {}
    const maxs: any = {}

    Object.keys(metrics).forEach(k => {
      mins[k] = Math.min(...metrics[k])
      maxs[k] = Math.max(...metrics[k])
    })

    return clean.map((p, i) => {
      let score = 0

      const add = (key: string, weight: number) => {
        const val = metrics[key][i]
        score += normalize(val, mins[key], maxs[key]) * weight
      }

      if (position === "ATT") {
        add("goals", 0.3)
        add("xg", 0.25)
        add("shots", 0.15)
        add("conv", 0.3)
      }

      if (position === "MID") {
        add("key", 0.3)
        add("prog", 0.3)
        add("pass", 0.2)
        add("ast", 0.2)
      }

      if (position === "DEF") {
        add("tkl", 0.25)
        add("int", 0.25)
        add("clr", 0.25)
        add("aer", 0.25)
      }

      if (position === "GK") {
        add("save", 0.5)
        add("saves", 0.3)
        add("cs", 0.2)
      }

      const finalScore = Math.round(score * 100)

      const value = num(p.Value) || 1
      const valueScore = finalScore / value

      let tag = "🔴 Weak"
      if (finalScore >= 85) tag = "🟢 Elite"
      else if (finalScore >= 70) tag = "🟢 Strong"
      else if (finalScore >= 55) tag = "🟡 Decent"

      if (valueScore > 0.02 && finalScore > 70) tag = "💎 Hidden Gem"
      if (valueScore < 0.005 && finalScore < 60) tag = "⚠️ Overpriced"

      return {
        ...p,
        Value: num(p.Value),
        Wage: num(p.Wage),
        score: finalScore,
        tag
      }
    }).sort((a, b) => b.score - a.score)
  }

  const handleUpload = (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const scored = calculateScores(results.data)
        setPlayers(scored)
      }
    })
  }

  const exportCSV = () => {
    const rows = [
      ["Name", "Score", "Value", "Wage", "Tag"],
      ...players.map(p => [
        p.Name, p.score, p.Value, p.Wage, p.tag
      ])
    ]

    const blob = new Blob([rows.map(r => r.join(",")).join("\n")])
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "fm_value_scout.csv"
    a.click()
  }

  return (
    <div style={{ padding: 20, background: "#0B1220", minHeight: "100vh", color: "white" }}>
      <h1 style={{ color: "#22c55e" }}>FM Value Scout</h1>

      <select value={position} onChange={(e) => setPosition(e.target.value)}>
        <option value="ATT">Attackers</option>
        <option value="MID">Midfielders</option>
        <option value="DEF">Defenders</option>
        <option value="GK">Goalkeepers</option>
      </select>

      <input type="file" onChange={handleUpload} />

      <button onClick={exportCSV}>Export</button>

      {players.map((p, i) => (
        <div key={i} style={{
          marginTop: 20,
          padding: 15,
          background: "#111827",
          borderRadius: 10,
          border: "1px solid #22c55e"
        }}>
          <h3>{p.Name}</h3>
          <p>Score: {p.score} | {p.tag}</p>
          <p>Value: £{p.Value} | Wage: £{p.Wage}</p>

          <div style={{ width: "100%", height: 150 }}>
            <ResponsiveContainer>
              <BarChart data={[{ name: "Score", value: p.score }]}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  )
}
