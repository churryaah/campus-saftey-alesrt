import React, { useState } from 'react'
import { Download, Check } from 'lucide-react'

export default function ExportButton({ history, alertLog }) {
  const [done, setDone] = useState(false)

  function exportCSV() {
    if (!history.length) return

    // ── Sensor readings CSV ─────────────────────────────────
    const sensorHeaders = ['timestamp', 'temperature_C', 'humidity_%', 'gasLevel_raw', 'vibration_G', 'alert']
    const sensorRows = history.map(d =>
      [d.time, d.temperature, d.humidity, d.gasLevel, d.vibration, `"${d.alert}"`].join(',')
    )
    const sensorCSV = [sensorHeaders.join(','), ...sensorRows].join('\n')

    // ── Alert events CSV ────────────────────────────────────
    const alertHeaders = ['date', 'time', 'alert', 'temperature_C', 'humidity_%', 'gasLevel_raw', 'vibration_G']
    const alertRows = alertLog.map(e =>
      [e.dateDisplay, e.timeDisplay, `"${e.alert}"`, e.temperature, e.humidity, e.gasLevel, e.vibration].join(',')
    )
    const alertCSV = [alertHeaders.join(','), ...alertRows].join('\n')

    // Pack both into one download as two sections
    const full = `SafetyHub Sensor Readings\n${sensorCSV}\n\nAlert Event Log\n${alertCSV}`
    const blob = new Blob([full], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `safetyhub_export_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <button onClick={exportCSV}
      disabled={!history.length}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-semibold
                 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: done ? 'rgba(52,211,153,0.15)' : 'rgba(0,255,200,0.1)',
        border: `1px solid ${done ? 'rgba(52,211,153,0.4)' : 'rgba(0,255,200,0.25)'}`,
        color: done ? '#34d399' : 'var(--cyan)',
      }}>
      {done
        ? <><Check size={13} /> Exported!</>
        : <><Download size={13} /> Export CSV</>
      }
    </button>
  )
}
