"use client"

import React, { useState } from "react"
import Papa from "papaparse"

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
  const [selected, setSelected] = useState<Player | null>(null)
  const [shortlist, setShortlist] = useState<Player[]>([])
  const [position, setPosition] = useState("ATT")

  const num = (v: any) => Number(v) || 0

  const normalize = (val: number, min: number, max: number) =>
    max === min ? 0 : (val - min) / (max - min)

  const calculateScores = (data: any[]): Player[] => {
    const clean = data.filter(p => p.Name)

    const get = (k: string) => clean.map(p => num(p[k]))

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
        ast: get("Assists"),
        prog: get("Progressive Passes"),
        pass: get("Pass %")
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
        score += normalize(metrics[key][i], mins[key], maxs[key]) * weight
      }

      if (position === "ATT") {
        add("goals", 0.3)
        add("xg", 0.25)
        add("shots", 0.15)
        add("conv", 0.3)
      }

      if (position === "MID") {
        add("key", 0.3)
        add("ast", 0.25)
        add("prog", 0.25)
        add("pass", 0.2)
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
      if (finalScore > 80 && valueScore > 0.02) tag = "💎 Hidden Gem"
      else if (finalScore > 75) tag = "🟢 Elite"
      else if (finalScore > 60) tag = "🟡 Solid"
      else if (finalScore < 50 && value > 20) tag = "⚠️ Overpriced"

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
      complete: (res) => {
        const scored = calculateScores(res.data)
        setPlayers(scored)
      }
    })
  }

  const addToShortlist = (p: Player) => {
    if (!shortlist.find(x => x.Name === p.Name)) {
      setShortlist([...shortlist, p])
    }
  }

  const exportShortlist = () => {
    const rows = [
      ["Name", "Score", "Value", "Wage", "Tag"],
      ...shortlist.map(p => [p.Name, p.score, p.Value, p.Wage, p.tag])
    ]

    const blob = new Blob([rows.map(r => r.join(",")).join("\n")])
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "shortlist.csv"
    a.click()
  }

  const StatBar = ({ label, value }: any) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12 }}>{label}</div>
      <div style={{ background: "#1f2937", height: 8, borderRadius: 4 }}>
        <div style={{
          width: `${Math.min(value, 100)}%`,
          background: "#22c55e",
          height: "100%",
          borderRadius: 4
        }} />
      </div>
    </div>
  )

  return (
    <div style={{ background: "#0B1220", color: "white", minHeight: "100vh", padding: 20 }}>

      {/* HEADER */}
      <h1 style={{ color: "#22c55e" }}>FM Value Scout</h1>

      <div style={{ marginBottom: 10 }}>
        ⚠️ Upload one position at a time for accurate results
      </div>

      <select value={position} onChange={e => setPosition(e.target.value)}>
        <option value="ATT">Attackers</option>
        <option value="MID">Midfielders</option>
        <option value="DEF">Defenders</option>
        <option value="GK">Goalkeepers</option>
      </select>

      <input type="file" onChange={handleUpload} />

      <button onClick={exportShortlist}>Export Shortlist</button>

      {/* MAIN LAYOUT */}
      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>

        {/* LEFT TABLE */}
        <div style={{ width: "40%" }}>
          <h3>Players</h3>

          {players.map((p, i) => (
            <div key={i}
              onClick={() => setSelected(p)}
              style={{
                padding: 10,
                marginBottom: 8,
                background: "#111827",
                borderRadius: 8,
                cursor: "pointer"
              }}>
              {p.Name} — {p.score} ({p.tag})
            </div>
          ))}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: "60%" }}>
          {selected && (
            <div style={{
              padding: 20,
              background: "#111827",
              borderRadius: 12
            }}>
              <h2>{selected.Name}</h2>
              <p>{selected.score} — {selected.tag}</p>

              <p>💰 £{selected.Value} | 💸 £{selected.Wage}</p>

              {/* STAT BARS */}
              {position === "ATT" && (
                <>
                  <StatBar label="Goals" value={selected.Goals * 5} />
                  <StatBar label="xG" value={selected.xG * 5} />
                  <StatBar label="Shots" value={selected.Shots} />
                  <StatBar label="Conversion"
                    value={(selected.Goals / (selected.Shots || 1)) * 100} />
                </>
              )}

              {position === "MID" && (
                <>
                  <StatBar label="Key Passes" value={selected["Key Passes"] * 5} />
                  <StatBar label="Assists" value={selected.Assists * 10} />
                  <StatBar label="Prog Passes" value={selected["Progressive Passes"] * 5} />
                  <StatBar label="Pass %" value={selected["Pass %"]} />
                </>
              )}

              {position === "DEF" && (
                <>
                  <StatBar label="Tackles" value={selected.Tackles * 5} />
                  <StatBar label="Interceptions" value={selected.Interceptions * 5} />
                  <StatBar label="Clearances" value={selected.Clearances * 5} />
                  <StatBar label="Aerials" value={selected["Aerials Won"] * 5} />
                </>
              )}

              {position === "GK" && (
                <>
                  <StatBar label="Save %" value={selected["Save %"]} />
                  <StatBar label="Saves" value={selected.Saves * 2} />
                  <StatBar label="Clean Sheets" value={selected["Clean Sheets"] * 5} />
                </>
              )}

              <button onClick={() => addToShortlist(selected)}>
                ⭐ Add to Shortlist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SHORTLIST */}
      <div style={{ marginTop: 30 }}>
        <h3>⭐ Shortlist</h3>
        {shortlist.map((p, i) => (
          <div key={i}>{p.Name} — {p.score}</div>
        ))}
      </div>
    </div>
  )
}
