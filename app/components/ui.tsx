'use client';

import React, { memo } from 'react';
import { X, Star } from 'lucide-react';
import type { Player } from './types';
import { scoreColor } from './scoring';

// ── ScoreBadge ─────────────────────────────────────────────────────────────

export const ScoreBadge = memo(function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: scoreColor(score) }}>
      {score}
    </span>
  );
});

// ── StatBar ────────────────────────────────────────────────────────────────

export const StatBar = memo(function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ color: 'var(--vs-text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'monospace', color }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
});

// ── Tag ────────────────────────────────────────────────────────────────────

type TagVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
const TAG_COLORS: Record<TagVariant, [string, string]> = {
  default: ['rgba(255,255,255,0.08)', 'var(--vs-text-secondary)'],
  success: ['rgba(16,185,129,0.15)',  '#6ee7b7'],
  warning: ['rgba(245,158,11,0.15)',  '#fcd34d'],
  danger:  ['rgba(239,68,68,0.15)',   '#fca5a5'],
  info:    ['rgba(139,92,246,0.15)',  '#c4b5fd'],
};

export const Tag = memo(function Tag({ children, variant = 'default' }: { children: React.ReactNode; variant?: TagVariant }) {
  const [bg, fg] = TAG_COLORS[variant];
  return (
    <span style={{
      background: bg, color: fg,
      fontSize: 11, fontWeight: 500, padding: '2px 8px',
      borderRadius: 99, letterSpacing: '0.03em',
    }}>{children}</span>
  );
});

// ── EmptyState ─────────────────────────────────────────────────────────────

export const EmptyState = memo(function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--vs-text-secondary)' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.35 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--vs-text-primary)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14 }}>{body}</div>
    </div>
  );
});

// ── PlayerCard ─────────────────────────────────────────────────────────────

export const PlayerCard = memo(function PlayerCard({
  player, onRemove, compact = false,
}: { player: Player; onRemove?: () => void; compact?: boolean }) {
  return (
    <div style={{
      background: 'var(--vs-bg-card)',
      border: '0.5px solid var(--vs-border)',
      borderRadius: 'var(--vs-radius-lg)',
      padding: compact ? '12px 16px' : '16px 20px',
      position: 'relative',
    }}>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--vs-text-muted)', padding: 4,
        }}><X size={14} /></button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: compact ? 14 : 15 }}>{player.name}</div>
          <div style={{ fontSize: 12, color: 'var(--vs-text-secondary)', marginTop: 2 }}>
            {player.position} · {player.age}y · {player.league}
          </div>
        </div>
        <ScoreBadge score={player.valueScore} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {player.badge.icon && <Tag variant="info">{player.badge.icon} {player.badge.label}</Tag>}
          <Tag>{player.transferValue}</Tag>
          <Tag>{player.wage}</Tag>
        </div>
      )}
    </div>
  );
});

// ── RowActions ─────────────────────────────────────────────────────────────
// Extracted to avoid re-rendering the entire column defs on every copy click

interface RowActionsProps {
  player: Player;
  inShortlist: boolean;
  copied: boolean;
  onView: () => void;
  onCopy: () => void;
  onShortlist: () => void;
}

const btnBase: React.CSSProperties = {
  background: 'none',
  border: '0.5px solid var(--vs-border)',
  borderRadius: 'var(--vs-radius-sm)',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--vs-text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

export const RowActions = memo(function RowActions({ player, inShortlist, copied, onView, onCopy, onShortlist }: RowActionsProps) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={onView} style={btnBase}>👁 View</button>
      <button onClick={onCopy} style={btnBase}>{copied ? '✓ Copied!' : '📋 Copy'}</button>
      <button onClick={onShortlist} style={{
        ...btnBase,
        background: inShortlist ? 'var(--vs-accent-dim)' : 'none',
        border: `0.5px solid ${inShortlist ? 'var(--vs-accent-light)' : 'var(--vs-border)'}`,
        color: inShortlist ? '#c4b5fd' : 'var(--vs-text-primary)',
      }}>
        <Star size={13} fill={inShortlist ? 'currentColor' : 'none'} />
        {inShortlist ? 'Listed' : 'Shortlist'}
      </button>
    </div>
  );
});
