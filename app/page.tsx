

"use client"

import { useState } from "react"
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

  const normalize = (val: number, min: number, max: number) => {
    if (max === min) return 0
    return (val - min) / (max - min)
  }

  const calculateScores = (data: any[]): Player[] => {
    const clean = data.filter(p => p.Name)

    const metric = (key: string) => clean.map(p => num(p[key]))

    let m: any = {}

    if (position === "ATT") {
      m = {
        goals: metric("Goals"),
        xg: metric("xG"),
        shots: metric("Shots"),
        conv: clean.map(p => num(p.Goals) / (num(p.Shots) || 1))
      }
    }

    if (position === "MID") {
      m = {
        key: metric("Key Passes"),
        ast: metric("Assists"),
        prog: metric("Progressive Passes"),
        pass: metric("Pass %")
      }
    }

    if (position === "DEF") {
      m = {
        tkl: metric("Tackles"),
        int: metric("Interceptions"),
        clr: metric("Clearances"),
        aer: metric("Aerials Won")
      }
    }

    if (position === "GK") {
      m = {
        save: metric("Save %"),
        saves: metric("Saves"),
        cs: metric("Clean Sheets")
      }
    }

    const mins: any = {}
    const maxs: any = {}

    Object.keys(m).forEach(k => {
      mins[k] = Math.min(...m[k])
      maxs[k] = Math.max(...m[k])
    })

    return clean.map((p, i) => {
      let score = 0

      const add = (key: string, weight: number) => {
        score += normalize(m[key][i], mins[key], maxs[key]) * weight
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
      if (finalScore > 85 && valueScore > 0.02) tag = "💎 Hidden Gem"
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
    const file = e.target.files?.[0]
    if (!file) return

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res: any) => {
          // ✅ CLEAN DATA + FIX NAME
          const cleaned = (res.data as any[])
            .filter((row: any) => row && Object.keys(row).length > 0)
            .map((row: any) => ({
              ...row,

              // 🔥 NAME FIX (THIS IS THE IMPORTANT BIT)
              Name: row["Name"] || row["Player"] || "Unknown",

              // BASIC STATS (safe fallback)
              Goals: Number(row["Goals"] || row["Gls"] || 0),
              xG: Number(row["xG"] || 0),
              Shots: Number(row["Shots"] || row["Sh"] || 0),

              Assists: Number(row["Assists"] || row["Ast"] || 0),
              "Key Passes": Number(row["Key Passes"] || row["KP"] || 0),

              Tackles: Number(row["Tackles"] || 0),
              Interceptions: Number(row["Interceptions"] || 0),
              Clearances: Number(row["Clearances"] || 0),

              Value: Number(row["Value"] || row["Transfer Value"] || 0),
              Wage: Number(row["Wage"] || row["Salary"] || 0),

              Position: row["Position"] || "",
            }))
            .filter((p: any) => p.Name && p.Name !== "Unknown")

          // ✅ SCORE (UNCHANGED)
          const scored = calculateScores(cleaned)

          // ✅ SET STATE
          setPlayers(scored)
        }
      })
    } catch (e) {
      console.error(e)
      alert("Upload failed. Try a different file.")
    }
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

  const Bar = ({ label, value }: any) => (
    <div style={{ marginBottom: 8 }}>
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
      <h1 style={{ color: "#22c55e" }}>FM Value Scout</h1>

      <p>⚠️ Upload ONE position at a time</p>

      <select value={position} onChange={e => setPosition(e.target.value)}>
        <option value="ATT">Attackers</option>
        <option value="MID">Midfielders</option>
        <option value="DEF">Defenders</option>
        <option value="GK">Goalkeepers</option>
      </select>

      <input type="file" onChange={handleUpload} />
      <button onClick={exportShortlist}>Export Shortlist</button>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <div style={{ width: "40%" }}>
          {players.map((p, i) => (
            <div key={i} onClick={() => setSelected(p)}
              style={{ padding: 10, marginBottom: 8, background: "#111827", cursor: "pointer" }}>
              {p.Name} — {p.score} ({p.tag})
            </div>
          ))}
        </div>

        <div style={{ width: "60%" }}>
          {selected && (
            <div style={{ padding: 20, background: "#111827" }}>
              <h2>{selected.Name}</h2>
              <p>{selected.score} — {selected.tag}</p>
              <p>£{selected.Value} | £{selected.Wage}</p>

              {position === "ATT" && (
                <>
                  <Bar label="Goals" value={selected.Goals * 5} />
                  <Bar label="xG" value={selected.xG * 5} />
                  <Bar label="Shots" value={selected.Shots} />
                </>
              )}

              {position === "MID" && (
                <>
                  <Bar label="Key Passes" value={selected["Key Passes"] * 5} />
                  <Bar label="Assists" value={selected.Assists * 10} />
                  <Bar label="Progressive" value={selected["Progressive Passes"] * 5} />
                </>
              )}

              {position === "DEF" && (
                <>
                  <Bar label="Tackles" value={selected.Tackles * 5} />
                  <Bar label="Interceptions" value={selected.Interceptions * 5} />
                  <Bar label="Clearances" value={selected.Clearances * 5} />
                </>
              )}

              {position === "GK" && (
                <>
                  <Bar label="Save %" value={selected["Save %"]} />
                  <Bar label="Saves" value={selected.Saves * 2} />
                  <Bar label="Clean Sheets" value={selected["Clean Sheets"] * 5} />
                </>
              )}

              <button onClick={() => addToShortlist(selected)}>
                ⭐ Add to Shortlist
              </button>
            </div>
          )}
        </div>
      </div>

      <h3>Shortlist</h3>
      {shortlist.map((p, i) => (
        <div key={i}>{p.Name} — {p.score}</div>
      ))}
    </div>
  )
}
