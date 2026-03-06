import React, { useState } from 'react'
import { Thermometer, Droplets, Wind, Activity, Bell } from 'lucide-react'
import SensorCard from '../components/SensorCard'
import AlertBanner from '../components/AlertBanner'
import StatusPanel from '../components/StatusPanel'
import RealtimeChart from '../components/RealtimeChart'

function getSensorStatus(key, val) {
  if (val === null || val === undefined) return 'safe'
  const thresholds = {
    temperature: { warn: 35, danger: 45 },
    humidity:    { warn: 75, danger: 90 },
    gasLevel:    { warn: 500, danger: 800 },
    vibration:   { warn: 1.0, danger: 2.5 },
  }
  const t = thresholds[key]
  if (!t) return 'safe'
  if (val >= t.danger) return 'danger'
  if (val >= t.warn)   return 'warning'
  return 'safe'
}

function getSublabel(key, val) {
  if (val === null || val === undefined) return '—'
  const labels = {
    gasLevel:    ['Good Air',    'Moderate',       'Hazardous'],
    vibration:   ['Stable',      'Minor Activity', 'Earthquake!'],
    temperature: ['Comfortable', 'Warm',           'Critical Heat'],
    humidity:    ['Normal',      'High',           'Saturated'],
  }
  const t = { temperature: [35,45], humidity: [75,90], gasLevel: [500,800], vibration: [1.0,2.5] }
  const lb = labels[key]; const th = t[key]
  if (!lb) return ''
  if (val >= th[1]) return lb[2]
  if (val >= th[0]) return lb[1]
  return lb[0]
}

export default function HomePage({ data, history, status, lastUpdated, alertActive, pollCount, uptime, error }) {
  const [dismissed, setDismissed] = useState(false)
  const [showCharts, setShowCharts] = useState(false)

  // Spark values extracted from rolling history
  const spark = key => history.map(d => d[key]).filter(v => v !== undefined)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Safety Hub</p>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white">KGiSL</h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {alertActive && !dismissed && (
            <button className="relative" onClick={() => setDismissed(false)}>
              <Bell size={20} style={{ color: 'var(--cyan)' }} />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500" />
            </button>
          )}
          <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400' : status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'}`}
              style={status === 'online' ? { boxShadow: '0 0 6px #34d399' } : {}} />
            <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
              {status === 'online' ? 'LIVE' : status === 'offline' ? 'OFFLINE' : 'CONNECTING'}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {alertActive && !dismissed && (
        <AlertBanner message={data?.alert} onDismiss={() => setDismissed(true)} />
      )}

      {/* Seismic Hero Card */}
      <div className="glass-active glow-cyan p-5 relative overflow-hidden"
        style={{ border: '1px solid rgba(0,255,200,0.2)' }}>
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none rounded-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} style={{ color: 'var(--cyan)' }} />
            <span className="text-xs font-mono tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Seismic Activity</span>
            <div className="ml-auto flex items-center gap-1.5 glass px-2 py-0.5 rounded-md">
              <div className="live-dot" />
              <span className="text-[10px] font-mono" style={{ color: 'var(--cyan)' }}>LIVE</span>
            </div>
          </div>
          <div className="flex items-end gap-4 mt-3">
            <div>
              <div className="text-6xl font-display font-bold leading-none" style={{ color: 'var(--cyan)' }}>
                {data?.vibration?.toFixed(2) ?? '—'}
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: 'var(--muted)' }}>MAGNITUDE (G)</div>
            </div>
            <div className="ml-auto text-right pb-1">
              <div className="text-2xl font-display font-semibold" style={{ color: 'var(--muted)' }}>5.0 km</div>
              <div className="text-xs font-mono" style={{ color: 'var(--muted)' }}>DEPTH EST.</div>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-full ${
            getSensorStatus('vibration', data?.vibration) === 'danger'
              ? 'bg-red-900/50 text-red-400 border border-red-500/40'
              : getSensorStatus('vibration', data?.vibration) === 'warning'
              ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30'
              : 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30'
          }`}>
            <span>{getSublabel('vibration', data?.vibration)}</span>
          </div>
        </div>
      </div>

      {/* Sensor Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        <SensorCard icon={Thermometer} label="Temperature"
          value={data?.temperature?.toFixed(1) ?? null} unit="°C"
          status={getSensorStatus('temperature', data?.temperature)}
          accent="#FF6B35" sublabel={getSublabel('temperature', data?.temperature)}
          sparkValues={spark('temperature')} />
        <SensorCard icon={Droplets} label="Humidity"
          value={data?.humidity?.toFixed(1) ?? null} unit="%"
          status={getSensorStatus('humidity', data?.humidity)}
          accent="#00B4FF" sublabel={getSublabel('humidity', data?.humidity)}
          sparkValues={spark('humidity')} />
      </div>
      <SensorCard icon={Wind} label="Gas Level"
        value={data?.gasLevel ?? null} unit=" ppm"
        status={getSensorStatus('gasLevel', data?.gasLevel)}
        accent="#00FFC8" sublabel={getSublabel('gasLevel', data?.gasLevel)}
        sparkValues={spark('gasLevel')} />

      {/* System Status Panel */}
      <StatusPanel status={status} lastUpdated={lastUpdated}
        pollCount={pollCount} uptime={uptime} error={error} />

      {/* Live Charts toggle */}
      <button onClick={() => setShowCharts(s => !s)}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono tracking-widest uppercase transition-all"
        style={{
          background: showCharts ? 'rgba(0,255,200,0.08)' : 'rgba(0,255,200,0.04)',
          border: '1px solid rgba(0,255,200,0.15)',
          color: 'var(--cyan)',
        }}>
        {showCharts ? '▲ Hide Charts' : '▼ Show Live Charts'}
      </button>

      {showCharts && (
        <div className="flex flex-col gap-3">
          <RealtimeChart data={history} dataKey="temperature" label="Temperature" unit="°C"
            color="#FF6B35" domain={[15, 60]} warnLine={35} dangerLine={45} />
          <RealtimeChart data={history} dataKey="humidity" label="Humidity" unit="%"
            color="#00B4FF" domain={[0, 100]} warnLine={75} dangerLine={90} />
          <RealtimeChart data={history} dataKey="gasLevel" label="Gas Level" unit=" ppm"
            color="#00FFC8" warnLine={500} dangerLine={800} />
          <RealtimeChart data={history} dataKey="vibration" label="Seismic" unit=" G"
            color="#A78BFA" domain={[0, 3]} warnLine={1.0} dangerLine={2.5} />
        </div>
      )}

      {/* Last updated footer */}
      <div className="flex items-center justify-center gap-2 py-1">
        <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Connecting...'}
        </span>
        <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  )
}
