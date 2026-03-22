// @ts-nocheck
"use client";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* BACKGROUND GLOW */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-black blur-2xl opacity-60" />

      <div className="relative z-10 p-8 max-w-6xl mx-auto">

        {/* HERO */}
        <div className="text-center py-20">
          <h1 className="text-5xl font-bold text-purple-400 mb-6">
            ValueScout 💰
          </h1>

          <h2 className="text-3xl font-semibold mb-4">
            Find £5k/week players performing like £300k/week stars
          </h2>

          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Upload your Football Manager data and instantly discover
            undervalued players using real performance metrics.
          </p>

          <div className="flex justify-center gap-4">
            <button className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-semibold">
              🚀 Upload Data
            </button>

            <button className="border border-purple-500 px-6 py-3 rounded-lg">
              📊 Try Demo
            </button>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            {
              title: "Upload Data",
              desc: "Import your scouted players via CSV",
            },
            {
              title: "Analyse",
              desc: "Position-based metrics calculate real output",
            },
            {
              title: "Find Value",
              desc: "Get 1–100 score based on performance vs cost",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white/5 border border-purple-800 p-6 rounded-xl backdrop-blur"
            >
              <h3 className="text-xl font-semibold mb-2 text-purple-300">
                {item.title}
              </h3>
              <p className="text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* FEATURES */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-10">
            Built for Moneyball saves
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Position-based scoring",
              "Value score (1–100)",
              "Red / Amber / Green rating",
              "Player comparison",
              "Shortlist system",
              "CSV export",
            ].map((f, i) => (
              <div
                key={i}
                className="bg-purple-900/20 border border-purple-800 p-4 rounded-lg"
              >
                ✅ {f}
              </div>
            ))}
          </div>
        </div>

        {/* USE CASE */}
        <div className="bg-purple-900/20 border border-purple-700 p-8 rounded-xl mb-20 text-center">
          <p className="text-lg text-gray-300 mb-4">
            You’re paying £300k/week for 0.4 xG per 90…
          </p>

          <p className="text-xl font-semibold text-purple-300">
            ValueScout finds the same output for £5k/week
          </p>
        </div>

        {/* CTA */}
        <div className="text-center py-16">
          <h2 className="text-3xl font-bold mb-4">
            Start finding undervalued players today
          </h2>

          <button className="bg-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-500">
            🚀 Get Started
          </button>
        </div>

        {/* FOOTER */}
        <div className="text-center text-gray-500 mt-10">
          ValueScout • Data-driven recruitment ⚽
        </div>

      </div>
    </div>
  );
}