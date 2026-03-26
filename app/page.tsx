"use client"
import React, { useState } from "react"
import Papa from "papaparse"
type Player = {
  name: string
  age: number
  position: string
  score: number
  value: number
  best?: boolean
}
// SAFE NUMBER
const safe = (val: any): number => {
  const num = Number(val)
  return isNaN(num) ? 0 : num
}
// CLEAN DATA
const cleanData = (data: any[]): any[] => {
  return data.filter((row) => row["Name"] && row["Name"] !== "")
}
// DETECT POSITION
const detectPosition = (row: any): string => {
  const pos = row["Position"] || ""
  if (pos.includes("GK")) return "GK"
  if (pos.match(/CB|LB|RB/)) return "DEF"
  if (pos.match(/CM|AM|DM/)) return "MID"
  if (pos.match(/ST|CF/)) return "ATT"
  return "UNK"
}
// CALCULATE SCORE
const calculateScore = (row: any): number => {
  return (
    safe(row["Key Passes"]) * 2 +
    safe(row["Progressive Passes"]) * 1.5 +
    safe(row["Pass %"]) * 1
  )
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
            position: detectPosition(row),
            score,
            value,
          }
        })
        // SORT BY SCORE
        const sorted = [...mapped].sort((a, b) => b.score - a.score)
        // BEST BARGAIN (score/value)
        const bestValue = Math.max(
          ...sorted.map((p) => p.score / (p.value || 1))
        )
        const finalPlayers = sorted.map((p) => ({
          ...p,
          best: (p.score / (p.value || 1)) === bestValue,
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
        {/* EMPTY STATE */}
        {players.length === 0 && (
          <div className="text-gray-500 text-center mt-20">
            Upload a CSV to start scouting players ⚽
          </div>
        )}
        {/* PLAYER GRID */}
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
              {p.best && (
                <div className="text-xs text-green-400 mb-2">
                  🏆 BEST BARGAIN
                </div>
              )}
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="text-sm text-gray-400">
                {p.position} • Age {p.age}
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div>Score: {Math.round(p.score)}</div>
                <div>Value: {p.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
