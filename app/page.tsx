"use client"

import React, { useState } from "react"
import Papa from "papaparse"

type Player = {
  name: string
  age: number
  position: string
  score: number
  value: number
  valueScore: number
  best?: boolean
  wonderkid?: boolean
}

// SAFE NUMBER
const safe = (val: any): number => {
  const num = Number(val)
  return isNaN(num) ? 0 : num
}

// CLEAN DATA
const cleanData = (data: any[]): any[] => {
  return data.filter((row) => row["Name"])
}

// FM POSITION SCORING
const calculateScore = (row: any): number => {
  const pos = row["Position"] || ""

  const key = safe(row["Key Passes"])
  const prog = safe(row["Progressive Passes"])
  const pass = safe(row["Pass %"])

  // STRIKERS
  if (pos.includes("ST")) {
    return key * 1 + prog * 1.2 + pass * 0.5
  }

  // MIDFIELDERS
  if (pos.match(/CM|AM|DM/)) {
    return key * 2 + prog * 1.5 + pass * 1
  }

  // DEFENDERS
  if (pos.match(/CB|LB|RB/)) {
    return prog * 1.2 + pass * 1.5
  }

  return key + prog + pass
}

// WONDERKID
const isWonderkid = (age: number, score: number) => {
  return age <= 21 && score > 150
}

// VALUE SCORE
const valueScore = (score: number, value: number) => {
  if (!value) return score
  return score / value
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([])

  const handleFile = (e: any) => {
    const file = e.target.files[0]

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const cleaned = cleanData(results.data)

        const mapped: Player[] = cleaned.map((row: any) => {
          const score = calculateScore(row)
          const value = safe(row["Value"])

          return {
            name: row["Name"],
            age: safe(row["Age"]),
            position: row["Position"],
            score,
            value,
            valueScore: valueScore(score, value),
          }
        })

        // ENRICH
        const enriched = mapped.map((p) => ({
          ...p,
          wonderkid: isWonderkid(p.age, p.score),
        }))

        // SORT BY PERFORMANCE
        const sorted = [...enriched].sort((a, b) => b.score - a.score)

        // BEST BARGAIN
        const bestValue = Math.max(...enriched.map((p) => p.valueScore))

        const finalPlayers = sorted.map((p) => ({
          ...p,
          best: p.valueScore === bestValue,
        }))

        setPlayers(finalPlayers)
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-green-400">
            ValueScout
          </h1>
          <p className="text-gray-400">
            Find the best bargains instantly ⚽
          </p>
        </header>

        {/* UPLOAD */}
        <div className="mb-8 p-6 bg-[#111827] rounded-xl border border-gray-700">
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="text-sm"
          />
        </div>

        {/* EMPTY */}
        {players.length === 0 && (
          <div className="text-gray-500 text-center mt-20">
            Upload a CSV to start scouting players ⚽
          </div>
        )}

        {/* GRID */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.slice(0, 12).map((p, i) => (
            <div
              key={i}
              className={`p-5 rounded-xl border transition hover:scale-105 ${
                p.best
                  ? "bg-green-900/30 border-green-400 shadow-lg shadow-green-500/20"
                  : "bg-[#111827] border-gray-700"
              }`}
            >
              {/* BADGES */}
              <div className="flex gap-2 mb-2 text-xs">
                {p.best && (
                  <span className="text-green-400">🏆 BEST BARGAIN</span>
                )}
                {p.wonderkid && (
                  <span className="text-blue-400">💎 WONDERKID</span>
                )}
              </div>

              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="text-sm text-gray-400">
                {p.position} • Age {p.age}
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <div>Score: {Math.round(p.score)}</div>
                <div>Value: £{p.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
