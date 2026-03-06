import React, { useState } from 'react'
import RealtimeChart from '../components/RealtimeChart'
import ExportButton from '../components/ExportButton'

function StatCard({ label, value, unit, color, sub }) {
  return (
    <div className="glass p-4 flex flex-col gap-1.5">
      <div className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-display font-bold leading-none" style={{ color }}>
          {value !== null && value !== undefined ? value : <span style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>—</span>}
        </span>
        {value !== null && value !== undefined && (
          <span className="text-xs font-mono mb-0.5" style={{ color: 'var(--muted)' }}>{unit}</span>
        )}
      </div>
      {sub && <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

export default function AnalyticsPage({ data, history, alertLog }) {
  const [activeChart, setActiveChart] = useState('all')

  const avg = key => {
    if (!history.length) return null
    return (history.reduce((s, d) => s + (d[key] || 0), 0) / history.length).toFixed(1)
  }
  const max = key => {
    if (!history.length) return null
    return Math.max(...history.map(d => d[key] || 0)).toFixed(1)
  }
  const min = key => {
    if (!history.length) return null
    return Math.min(...history.map(d => d[key] || 0)).toFixed(1)
  }

  const charts = [
    { key: 'temperature', label: 'Temperature', unit: '°C',  color: '#FF6B35', domain: [15,60], warn: 35, danger: 45 },
    { key: 'humidity',    label: 'Humidity',    unit: '%',   color: '#00B4FF', domain: [0,100], warn: 75, danger: 90 },
    { key: 'gasLevel',    label: 'Gas Level',   unit: ' ppm', color: '#00FFC8', warn: 500,  danger: 800 },
    { key: 'vibration',   label: 'Seismic',     unit: ' G',  color: '#A78BFA', domain: [0,3],  warn: 1.0, danger: 2.5 },
  ]

  const chartTabs = ['all', ...charts.map(c => c.key)]

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Safety Hub</p>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Analytics</h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-lg">
            <div className="live-dot" />
            <span className="text-[10px] font-mono" style={{ color: 'var(--cyan)' }}>LIVE</span>
          </div>
          <ExportButton history={history} alertLog={alertLog} />
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Avg Temperature" value={avg('temperature')} unit="°C" color="#FF6B35"
          sub={`Min: ${min('temperature')}°C  Max: ${max('temperature')}°C`} />
        <StatCard label="Max Temperature" value={max('temperature')} unit="°C" color="#FFB800" />
        <StatCard label="Avg Gas Level"   value={avg('gasLevel')}   unit=" ppm" color="#00FFC8"
          sub={`Max: ${max('gasLevel')} ppm`} />
        <StatCard label="Max Gas Level"   value={max('gasLevel')}   unit=" ppm" color="#FFB800" />
        <StatCard label="Avg Seismic"     value={avg('vibration')}  unit=" G"   color="#A78BFA"
          sub={`Max: ${max('vibration')} G`} />
        <StatCard label="Avg Humidity"    value={avg('humidity')}   unit="%"    color="#00B4FF" />
      </div>

      {/* Chart selector tabs */}
      <div className="glass p-1 rounded-xl flex gap-1 overflow-x-auto">
        {chartTabs.map(t => (
          <button key={t} onClick={() => setActiveChart(t)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all"
            style={{
              background: activeChart === t ? 'rgba(0,255,200,0.15)' : 'transparent',
              color: activeChart === t ? 'var(--cyan)' : 'var(--muted)',
            }}>
            {t === 'all' ? 'All' : t === 'gasLevel' ? 'Gas' : t.charAt(0).toUpperCase() + t.slice(1, 4)}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="flex flex-col gap-3">
        {charts
          .filter(c => activeChart === 'all' || activeChart === c.key)
          .map(c => (
            <RealtimeChart key={c.key}
              data={history} dataKey={c.key} label={c.label}
              unit={c.unit} color={c.color}
              domain={c.domain} warnLine={c.warn} dangerLine={c.danger}
              height={activeChart === 'all' ? 90 : 140}
            />
          ))
        }
      </div>

      {/* Session summary */}
      <div className="glass p-4">
        <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>Session Summary</div>
        {[
          { label: 'Total Readings',    val: history.length },
          { label: 'Alert Events',      val: alertLog.filter(e => !e.isNormal).length },
          { label: 'Historical Events', val: alertLog.length },
          { label: 'Data Points / Metric', val: `${history.length} / 30 max` },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center justify-between py-2.5"
            style={{ borderBottom: '1px solid rgba(0,255,200,0.05)' }}>
            <span className="text-sm font-sans" style={{ color: 'var(--muted)' }}>{label}</span>
            <span className="text-sm font-mono font-medium text-white">{val}</span>
          </div>
        ))}
      </div>

      {/* Future sensor nodes placeholder */}
      <div className="glass p-4 rounded-xl"
        style={{ border: '1px dashed rgba(0,255,200,0.15)' }}>
        <div className="text-xs font-mono tracking-widest uppercase mb-2" style={{ color: 'var(--muted)' }}>
          Additional Nodes
        </div>
        <div className="flex items-center gap-2 py-2 opacity-40">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs font-sans" style={{ color: 'var(--muted)' }}>Node 2 — Not connected</span>
        </div>
        <div className="flex items-center gap-2 py-2 opacity-40">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs font-sans" style={{ color: 'var(--muted)' }}>Node 3 — Not connected</span>
        </div>
        <div className="text-[10px] font-mono mt-2" style={{ color: 'var(--muted)' }}>
          Additional ESP32 nodes can be added here without modifying core firmware
        </div>
      </div>
    </div>
  )
}
