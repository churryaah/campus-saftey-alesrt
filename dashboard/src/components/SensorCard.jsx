import React, { useEffect, useRef } from 'react'

const STATUS_CONFIG = {
  safe:    { label: 'SAFE',   cls: 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30', dot: '#34d399', glow: 'rgba(52,211,153,0.15)' },
  warning: { label: 'WARN',   cls: 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30',   dot: '#fbbf24', glow: 'rgba(251,191,36,0.12)'  },
  danger:  { label: 'DANGER', cls: 'bg-red-900/40 text-red-400 border border-red-500/30',            dot: '#f87171', glow: 'rgba(248,113,113,0.2)'  },
}

// Tiny inline sparkline (last 8 values)
function Sparkline({ values = [], color }) {
  const w = 56, h = 24
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.slice(-8).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function SensorCard({ icon: Icon, label, value, unit, status = 'safe', accent = '#00FFC8', sublabel, sparkValues = [] }) {
  const cfg     = STATUS_CONFIG[status]
  const prevRef = useRef(value)
  const cardRef = useRef(null)

  // Flash animation on value change
  useEffect(() => {
    if (value !== prevRef.current && cardRef.current) {
      cardRef.current.animate(
        [{ opacity: 0.4 }, { opacity: 1 }],
        { duration: 300, easing: 'ease-out' }
      )
    }
    prevRef.current = value
  }, [value])

  return (
    <div ref={cardRef}
      className="glass relative overflow-hidden p-5 flex flex-col gap-3 transition-all duration-300"
      style={{
        borderColor: status === 'danger'  ? 'rgba(255,59,59,0.35)'
                   : status === 'warning' ? 'rgba(255,184,0,0.3)'
                   : undefined,
        boxShadow: `0 0 24px ${cfg.glow}`,
      }}
    >
      {/* Status dot + label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
            <Icon size={14} style={{ color: accent }} strokeWidth={2} />
          </div>
          <span className="text-xs font-mono tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{label}</span>
        </div>
        {/* Colored indicator dot */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full"
            style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }} />
          <span className={`text-[10px] font-mono font-semibold tracking-widest px-2 py-0.5 rounded ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Value + sparkline */}
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-1.5">
          {value !== null && value !== undefined ? (
            <>
              <span className="text-4xl font-display font-semibold leading-none" style={{ color: accent }}>
                {value}
              </span>
              <span className="text-sm font-mono mb-1" style={{ color: 'var(--muted)' }}>{unit}</span>
            </>
          ) : (
            <div className="h-10 w-24 rounded shimmer" />
          )}
        </div>
        <Sparkline values={sparkValues} color={accent} />
      </div>

      {/* Sublabel */}
      {sublabel && (
        <span className="text-xs font-sans" style={{ color: 'var(--muted)' }}>{sublabel}</span>
      )}

      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-40 rounded-b-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
    </div>
  )
}
