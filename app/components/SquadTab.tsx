'use client';

import React, { memo } from 'react';
import { Trash2, X } from 'lucide-react';
import { EmptyState, ScoreBadge } from './ui';
import { FORMATION_SLOTS, scoreColor } from './scoring';
import type { Player } from './types';
import { Star } from 'lucide-react';

interface SquadTabProps {
  shortlist: Player[];
  squad: (Player | null)[][];
  formation: string;
  setFormation: (f: string) => void;
  setSquad: (s: (Player | null)[][]) => void;
  squadStats: { avgScore: number; avgAge: number; gems: number };
}

export const SquadTab = memo(function SquadTab({
  shortlist, squad, formation, setFormation, setSquad, squadStats,
}: SquadTabProps) {
  const slots = FORMATION_SLOTS[formation];

  const clearSquad = () => setSquad(slots.map(row => row.map(() => null)));

  const dropPlayer = (rowIdx: number, colIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData('playerId'));
    const player = shortlist.find(p => p.id === id);
    if (!player) return;
    const next = squad.map(r => [...r]);
    next[rowIdx][colIdx] = player;
    setSquad(next);
  };

  const removeSlot = (rowIdx: number, colIdx: number) => {
    const next = squad.map(r => [...r]);
    next[rowIdx][colIdx] = null;
    setSquad(next);
  };

  return (
    <div>
      {/* Formation selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--vs-text-secondary)' }}>Formation:</span>
        {Object.keys(FORMATION_SLOTS).map(f => (
          <button key={f} onClick={() => {
            setFormation(f);
            setSquad(FORMATION_SLOTS[f].map(row => row.map(() => null)));
          }} style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: formation === f ? 'var(--vs-accent)' : 'var(--vs-bg-card)',
            color: formation === f ? 'white' : 'var(--vs-text-secondary)',
            border: formation === f ? 'none' : '0.5px solid var(--vs-border)',
          }}>{f}</button>
        ))}
        <button onClick={clearSquad} style={{
          marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          background: 'none', border: '0.5px solid rgba(239,68,68,0.4)', color: '#f87171',
          display: 'flex', alignItems: 'center', gap: 4,
        }}><Trash2 size={13} /> Clear</button>
      </div>

      {/* Stats */}
      {squad.flat().some(Boolean) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Avg score',   value: squadStats.avgScore, color: scoreColor(squadStats.avgScore) },
            { label: 'Avg age',     value: squadStats.avgAge,   color: 'var(--vs-text-secondary)' },
            { label: 'Hidden gems', value: `${squadStats.gems} 💎`, color: '#a78bfa' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, background: 'var(--vs-bg-card)', border: '0.5px solid var(--vs-border-soft)',
              borderRadius: 10, padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 500, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--vs-text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Pitch */}
        <div style={{
          flex: 1,
          background: 'rgba(5,46,22,0.35)',
          border: '0.5px solid rgba(34,197,94,0.15)',
          borderRadius: 16, padding: 20, minHeight: 440,
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.025) 59px, rgba(255,255,255,0.025) 60px)',
          ].join(','),
        }}>
          {slots.map((row, rowIdx) => (
            <div key={rowIdx} style={{
              display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14,
            }}>
              {row.map((slot, colIdx) => {
                const assigned = squad[rowIdx]?.[colIdx] ?? null;
                return (
                  <div key={colIdx}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => dropPlayer(rowIdx, colIdx, e)}
                    style={{
                      width: 80, background: assigned ? 'rgba(124,58,237,0.22)' : 'rgba(255,255,255,0.04)',
                      border: '0.5px solid ' + (assigned ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'),
                      borderRadius: 10, padding: '10px 6px', textAlign: 'center', minHeight: 76,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: 10, color: 'var(--vs-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {slot.label}
                    </div>
                    {assigned ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 2 }}>
                          {assigned.name.split(' ').slice(-1)[0]}
                        </div>
                        <div style={{ fontSize: 11, color: scoreColor(assigned.valueScore), fontWeight: 500 }}>
                          {assigned.valueScore}
                        </div>
                        <button onClick={() => removeSlot(rowIdx, colIdx)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--vs-text-faint)', marginTop: 2, padding: 0,
                        }}><X size={10} /></button>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--vs-text-faint)', marginTop: 4 }}>Drop</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Shortlist drag panel */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500, color: 'var(--vs-accent-light)',
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Shortlist ({shortlist.length})
          </div>
          {shortlist.length === 0
            ? <EmptyState icon={<Star />} title="No players shortlisted" body="Add players from the Upload tab first." />
            : shortlist.map(p => (
                <div key={p.id} draggable onDragStart={e => e.dataTransfer.setData('playerId', p.id.toString())}
                  style={{
                    background: 'var(--vs-bg-card)', border: '0.5px solid var(--vs-border-soft)',
                    borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                    cursor: 'grab', userSelect: 'none',
                  }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--vs-text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span>{p.position} · {p.age}y</span>
                    <ScoreBadge score={p.valueScore} />
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
});
