'use client';

import React, { memo } from 'react';
import { Upload, List, CheckCircle, BarChart3, Star } from 'lucide-react';

export const HowToTab = memo(function HowToTab() {
  const steps = [
    {
      step: '1', title: 'Export from FM26', icon: <Upload size={18} />,
      body: 'In FM26, open your Scouting Centre or Player Search. Install the BepInEx Player Export mod, then export any player list as a CSV. Make sure to add all recommended columns before exporting.',
    },
    {
      step: '2', title: 'Choose the right columns', icon: <List size={18} />,
      body: 'The Value Score algorithm needs specific columns to work accurately. Use the "Export Filters" tab to see exactly which columns to include for each position.',
    },
    {
      step: '3', title: 'Upload your CSV', icon: <CheckCircle size={18} />,
      body: 'Drag and drop your CSV onto the Upload tab, or click to browse. The tool automatically detects positions and calculates a Value Score (48–97) for every player.',
    },
    {
      step: '4', title: 'Read the scores', icon: <BarChart3 size={18} />,
      body: 'Green (85+) = excellent value. Purple (75–84) = solid. Amber (65–74) = borderline. Red (<65) = avoid. Badges like 💎 Hidden Gem flag standout opportunities.',
    },
    {
      step: '5', title: 'Build your shortlist', icon: <Star size={18} />,
      body: 'Click Shortlist on any player to save them. Export as CSV or PDF for sharing. Drag players into the Squad Builder to build and assess a formation.',
    },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      {steps.map(({ step, title, body, icon }) => (
        <div key={step} style={{
          display: 'flex', gap: 16, marginBottom: 16,
          background: 'var(--vs-bg-card)', border: '0.5px solid var(--vs-border-soft)',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'var(--vs-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--vs-accent-light)',
          }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>{step}. {title}</div>
            <div style={{ fontSize: 13, color: 'var(--vs-text-secondary)', lineHeight: 1.6 }}>{body}</div>
          </div>
        </div>
      ))}

      <div style={{
        background: 'var(--vs-accent-dim)', border: '0.5px solid var(--vs-border)',
        borderRadius: 12, padding: '16px 20px', marginTop: 8,
      }}>
        <div style={{ fontSize: 13, color: '#c4b5fd', fontWeight: 500, marginBottom: 4 }}>Balanced Mode</div>
        <div style={{ fontSize: 13, color: 'var(--vs-text-secondary)', lineHeight: 1.6 }}>
          Toggle in the top bar to apply an 8% score reduction across all players. Useful when a dataset
          feels inflated — it tightens the spread without changing the relative order.
        </div>
      </div>
    </div>
  );
});
