'use client';

import React, { memo } from 'react';
import { Shield } from 'lucide-react';
import { RECOMMENDED_COLUMNS } from './scoring';

export const FiltersTab = memo(function FiltersTab() {
  return (
    <div>
      <div style={{ fontSize: 14, color: 'var(--vs-text-secondary)', marginBottom: 20, maxWidth: 600 }}>
        Add these columns to your FM player list view before exporting via the BepInEx mod. More columns = more accurate scores.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {Object.entries(RECOMMENDED_COLUMNS).map(([pos, cols]) => (
          <div key={pos} style={{
            background: 'var(--vs-bg-card)', border: '0.5px solid var(--vs-border-soft)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <div style={{
              fontWeight: 500, fontSize: 14, marginBottom: 12,
              color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Shield size={14} />{pos}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cols.map(col => (
                <code key={col} style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 6,
                  background: 'var(--vs-accent-dim)', color: '#a78bfa',
                  border: '0.5px solid var(--vs-border-soft)',
                }}>{col}</code>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 24, padding: '14px 18px',
        background: 'rgba(5,150,105,0.1)', border: '0.5px solid rgba(5,150,105,0.3)',
        borderRadius: 10, fontSize: 13, color: '#6ee7b7', maxWidth: 560,
      }}>
        <strong>Tip:</strong> Always include Name, Age, Position, Transfer Value, Wage, League and Minutes as a minimum.
        Everything else improves accuracy for specific positions.
      </div>
    </div>
  );
});
