import React from 'react'
import { Cpu, Wifi, WifiOff, Cloud, Globe, Plus } from 'lucide-react'
import { DATA_MODE, CLOUD_BACKEND_URL } from '../services/sensorService'

function InfoRow({ label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between py-3"
      style={{ borderBottom: '1px solid rgba(0,255,200,0.06)' }}>
      <span className="text-sm font-sans" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className={`text-sm font-mono font-medium ${valueClass || 'text-white'}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="glass p-5">
      <div className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>{title}</div>
      {children}
    </div>
  )
}

export default function SettingsPage({ status, lastUpdated, error, pollCount, uptime, cloudStats }) {
  const online     = status === 'online'
  const isCloud    = DATA_MODE === 'cloud'

  function fmtUptime(s) {
    if (!s) return '0s'
    if (s < 60)   return `${s}s`
    if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-mono tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Safety Hub</p>
        <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Settings</h1>
      </div>

      {/* Data mode banner */}
      <div className="glass p-4 flex items-center gap-4"
        style={{
          borderColor: isCloud ? 'rgba(0,180,255,0.25)' : 'rgba(0,255,200,0.2)',
          boxShadow:   isCloud ? '0 0 20px rgba(0,180,255,0.08)' : '0 0 20px rgba(0,255,200,0.06)',
        }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isCloud ? 'rgba(0,180,255,0.12)' : 'rgba(0,255,200,0.1)' }}>
          {isCloud
            ? <Cloud size={20} style={{ color: '#00B4FF' }} />
            : <Wifi  size={20} style={{ color: 'var(--cyan)' }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-semibold"
            style={{ color: isCloud ? '#00B4FF' : 'var(--cyan)' }}>
            {isCloud ? '☁ Cloud Mode — Public Access' : '📡 Local Mode — ESP32 Direct'}
          </div>
          <div className="text-xs font-mono truncate mt-0.5" style={{ color: 'var(--muted)' }}>
            {isCloud
              ? CLOUD_BACKEND_URL
              : 'Reading from ESP32 at 192.168.4.1 — local WiFi only'
            }
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="glass p-4 flex items-center gap-4"
        style={{
          borderColor: online ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.3)',
          boxShadow:   online ? '0 0 20px rgba(52,211,153,0.08)' : '0 0 20px rgba(248,113,113,0.1)',
        }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: online ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }}>
          {online
            ? <Globe  size={20} style={{ color: '#34d399' }} />
            : <WifiOff size={20} style={{ color: '#f87171' }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-semibold"
            style={{ color: online ? '#34d399' : '#f87171' }}>
            {online
              ? (isCloud ? 'Cloud Backend Online' : 'ESP32 Connected')
              : (isCloud ? 'Cloud Backend Offline' : 'ESP32 Offline')
            }
          </div>
          <div className="text-xs font-mono truncate mt-0.5" style={{ color: 'var(--muted)' }}>
            {online
              ? (isCloud ? 'Receiving live data via SSE stream' : '192.168.4.1 · SafetyHub WiFi')
              : (error || 'Cannot connect')
            }
          </div>
        </div>
        {online && <div className="live-dot flex-shrink-0" />}
      </div>

      <Section title="System Information">
        <InfoRow label="Version"        value="2.0.0" />
        <InfoRow label="Zone"           value="KGiSL – Seminar Hall 1" />
        <InfoRow label="Data Mode"      value={isCloud ? '☁ Cloud' : '📡 Local'}
          valueClass={isCloud ? 'text-blue-400' : 'text-emerald-400'} />
        <InfoRow label="Data Refresh"   value={isCloud ? 'Realtime (SSE)' : 'Every 2 seconds'} />
        <InfoRow label="Last Updated"   value={lastUpdated ? lastUpdated.toLocaleTimeString() : '—'} />
        <InfoRow label="Session Reads"  value={pollCount?.toLocaleString?.() ?? '0'} />
        <InfoRow label="Session Uptime" value={fmtUptime(uptime)} />
        {isCloud && cloudStats && <>
          <InfoRow label="Total DB Readings" value={cloudStats.total_readings?.toLocaleString()} />
          <InfoRow label="Total DB Alerts"   value={cloudStats.alert_count} valueClass="text-red-400" />
          <InfoRow label="Max Temp (all time)" value={`${cloudStats.max_temperature}°C`} valueClass="text-orange-400" />
          <InfoRow label="Max Gas (all time)"  value={`${cloudStats.max_gas_level} ppm`} valueClass="text-cyan-400" />
        </>}
      </Section>

      <Section title="Alert Thresholds">
        <div className="text-xs font-sans mb-3" style={{ color: 'var(--muted)' }}>
          Configured in ESP32 firmware — read-only
        </div>
        <InfoRow label="Earthquake"       value="≥ 2.5 G"    valueClass="text-red-400 font-mono" />
        <InfoRow label="Gas Leak"         value="> 800 ppm"   valueClass="text-red-400 font-mono" />
        <InfoRow label="High Temperature" value="> 45.0 °C"   valueClass="text-red-400 font-mono" />
        <InfoRow label="High Humidity"    value="> 90 %"      valueClass="text-red-400 font-mono" />
        <InfoRow label="Warn Temperature" value="> 35.0 °C"   valueClass="text-yellow-400 font-mono" />
        <InfoRow label="Warn Gas Level"   value="> 500 ppm"   valueClass="text-yellow-400 font-mono" />
      </Section>

      <Section title="Sensor Hardware">
        <InfoRow label="Seismic"         value="MPU6050" />
        <InfoRow label="Gas"             value="MQ2 Series" />
        <InfoRow label="Temp / Humidity" value="DHT11" />
        <InfoRow label="Controller"      value="ESP32 DevKit V1" />
        <InfoRow label="Firmware"        value="SafetyHub v1.0" />
        <InfoRow label="I2C Pins"        value="SDA:21  SCL:22" />
        <InfoRow label="MQ2 ADC Pin"     value="GPIO 34 (ADC1)" />
        <InfoRow label="DHT11 Pin"       value="GPIO 4" />
      </Section>

      <Section title="Network">
        <InfoRow label="ESP32 API"      value="192.168.4.1/api/data" />
        <InfoRow label="WiFi SSID"      value="SafetyHub" />
        {isCloud ? <>
          <InfoRow label="Cloud Backend" value={CLOUD_BACKEND_URL?.replace('https://','')} valueClass="text-blue-400" />
          <InfoRow label="Realtime"      value="Server-Sent Events" valueClass="text-cyan-400" />
          <InfoRow label="Database"      value="PostgreSQL (Render)" valueClass="text-purple-400" />
        </> : <>
          <InfoRow label="Poll Interval" value="2000 ms" />
          <InfoRow label="Dashboard"     value="Local WiFi only" valueClass="text-yellow-400" />
        </>}
      </Section>

      <Section title="Connected Nodes">
        <div className="flex items-center gap-3 py-2.5"
          style={{ borderBottom: '1px solid rgba(0,255,200,0.06)' }}>
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px #34d399' }} />
          <span className="text-sm font-sans flex-1" style={{ color: 'var(--muted)' }}>Node 1 — KGiSL Seminar Hall 1</span>
          <span className="text-xs font-mono text-emerald-400">ACTIVE</span>
        </div>
        <div className="flex items-center gap-3 py-2.5 opacity-40"
          style={{ borderBottom: '1px solid rgba(0,255,200,0.06)' }}>
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-sm font-sans flex-1" style={{ color: 'var(--muted)' }}>Node 2 — Not connected</span>
          <span className="text-xs font-mono text-gray-500">OFFLINE</span>
        </div>
        <button className="flex items-center gap-2 mt-3 text-xs font-mono py-1 opacity-50 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--cyan)' }}>
          <Plus size={12} /> Add ESP32 Node
        </button>
      </Section>

      <div className="glass p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Cpu size={12} style={{ color: 'var(--cyan)' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--cyan)' }}>Campus Safety Hub</span>
        </div>
        <div className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>
          KGiSL Hackathon 2025 · ESP32 IoT System · v2.0.0
        </div>
      </div>
    </div>
  )
}
