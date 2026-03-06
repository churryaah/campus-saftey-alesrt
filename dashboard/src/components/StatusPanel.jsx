import React from 'react'
import { Wifi, WifiOff, Clock, RefreshCw, Cpu, Activity } from 'lucide-react'

function fmtUptime(secs) {
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs/60)}m ${secs%60}s`
  return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`
}

export default function StatusPanel({ status, lastUpdated, pollCount, uptime, error }) {
  const online = status === 'online'

  const rows = [
    {
      Icon: online ? Wifi : WifiOff,
      label: 'ESP32 Status',
      value: online ? 'Connected — 192.168.4.1' : (error || 'Offline'),
      color: online ? '#34d399' : '#f87171',
    },
    {
      Icon: Clock,
      label: 'Last Update',
      value: lastUpdated ? lastUpdated.toLocaleTimeString() : '—',
      color: 'var(--cyan)',
    },
    {
      Icon: RefreshCw,
      label: 'Poll Frequency',
      value: 'Every 2 seconds',
      color: 'var(--cyan)',
    },
    {
      Icon: Activity,
      label: 'Total Readings',
      value: pollCount.toLocaleString(),
      color: '#A78BFA',
    },
    {
      Icon: Cpu,
      label: 'Session Uptime',
      value: fmtUptime(uptime),
      color: '#00B4FF',
    },
  ]

  return (
    <div className="glass p-4 flex flex-col gap-1">
      <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>
        System Status
      </div>

      {/* Online/offline hero indicator */}
      <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 ${online ? '' : 'animate-pulse'}`}
        style={{
          background: online ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)',
          border: `1px solid ${online ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.3)'}`,
        }}>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: online ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)' }}>
          {online
            ? <Wifi size={16} style={{ color: '#34d399' }} />
            : <WifiOff size={16} style={{ color: '#f87171' }} />
          }
        </div>
        <div>
          <div className="text-sm font-display font-semibold" style={{ color: online ? '#34d399' : '#f87171' }}>
            {online ? 'ESP32 Online' : 'ESP32 Offline'}
          </div>
          <div className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
            {online ? 'Receiving live sensor data' : 'Connect to SafetyHub WiFi'}
          </div>
        </div>
        {online && <div className="ml-auto live-dot" />}
      </div>

      {/* Detail rows */}
      {rows.slice(1).map(({ Icon, label, value, color }) => (
        <div key={label} className="flex items-center gap-3 py-2"
          style={{ borderBottom: '1px solid rgba(0,255,200,0.05)' }}>
          <Icon size={13} style={{ color, flexShrink: 0 }} />
          <span className="text-xs font-sans flex-1" style={{ color: 'var(--muted)' }}>{label}</span>
          <span className="text-xs font-mono" style={{ color }}>{value}</span>
        </div>
      ))}
    </div>
  )
}
