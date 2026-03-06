import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, ShieldCheck, Flame, Wind, Activity } from 'lucide-react'
import ExportButton from '../components/ExportButton'

function alertIcon(msg) {
  if (!msg) return AlertTriangle
  const m = msg.toLowerCase()
  if (m.includes('earthquake') || m.includes('vibration')) return Activity
  if (m.includes('gas'))  return Wind
  if (m.includes('temp')) return Flame
  return AlertTriangle
}

function alertColor(msg) {
  if (!msg || msg === 'System Normal') return '#34d399'
  return '#FF3B3B'
}

export default function AlertsPage({ history, alertLog }) {
  const [filter, setFilter] = useState('all') // all | hazard | normal

  const filtered = alertLog.filter(e => {
    if (filter === 'hazard') return !e.isNormal
    if (filter === 'normal') return e.isNormal
    return true
  })

  const hazardCount = alertLog.filter(e => !e.isNormal).length

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Safety Hub</p>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Alert History</h1>
        </div>
        <ExportButton history={history} alertLog={alertLog} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Events', val: alertLog.length, color: 'var(--cyan)' },
          { label: 'Hazards',      val: hazardCount,     color: '#FF3B3B' },
          { label: 'All Clear',    val: alertLog.length - hazardCount, color: '#34d399' },
        ].map(({ label, val, color }) => (
          <div key={label} className="glass p-3 text-center rounded-xl">
            <div className="text-xl font-display font-bold" style={{ color }}>{val}</div>
            <div className="text-[10px] font-mono uppercase mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'hazard', 'normal'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all"
            style={{
              background: filter === f ? 'rgba(0,255,200,0.12)' : 'rgba(0,255,200,0.03)',
              border: `1px solid ${filter === f ? 'rgba(0,255,200,0.3)' : 'rgba(0,255,200,0.08)'}`,
              color: filter === f ? 'var(--cyan)' : 'var(--muted)',
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* Events list */}
      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-14 gap-3">
          <ShieldCheck size={32} style={{ color: 'var(--cyan)' }} />
          <div className="text-sm font-sans text-white font-medium">No Events Yet</div>
          <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Alert events will appear here in real time</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((e) => {
            const Icon  = alertIcon(e.alert)
            const color = alertColor(e.alert)
            const isNormal = e.isNormal
            return (
              <div key={e.id} className="glass p-4 flex items-start gap-3 transition-all"
                style={{
                  borderColor: isNormal ? 'rgba(52,211,153,0.2)' : 'rgba(255,59,59,0.25)',
                  boxShadow:   isNormal ? '0 0 12px rgba(52,211,153,0.05)' : '0 0 12px rgba(255,59,59,0.07)',
                }}>
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: `${color}18` }}>
                  {isNormal
                    ? <CheckCircle size={14} style={{ color }} />
                    : <Icon size={14} style={{ color }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-display font-semibold text-white leading-tight">{e.alert}</div>
                    <span className="flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${color}18`,
                        color,
                        border: `1px solid ${color}30`,
                      }}>
                      {isNormal ? 'CLEAR' : 'ALERT'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'var(--muted)' }}>
                    <span>{e.dateDisplay} {e.timeDisplay}</span>
                    {e.temperature !== undefined && <span>🌡 {e.temperature}°C</span>}
                    {e.gasLevel    !== undefined && <span>💨 {e.gasLevel} ppm</span>}
                    {e.vibration   !== undefined && <span>📳 {e.vibration?.toFixed?.(2)} G</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Session summary */}
      <div className="glass p-4">
        <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>Session Summary</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Readings',      val: history.length },
            { label: 'Unique Events', val: alertLog.length },
            { label: 'Data Window',   val: `${history.length} / 30 pts` },
            { label: 'Zone',          val: 'Seminar Hall 1' },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-xl p-3"
              style={{ background: 'rgba(0,255,200,0.04)', border: '1px solid rgba(0,255,200,0.08)' }}>
              <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</div>
              <div className="text-sm font-display font-semibold text-white mt-0.5">{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
