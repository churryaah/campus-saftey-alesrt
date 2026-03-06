import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

const CustomTooltip = ({ active, payload, label, unit, color }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass px-3 py-2 text-xs font-mono" style={{ borderColor: `${color}40`, minWidth: 80 }}>
        <div style={{ color: 'var(--muted)' }}>{label}</div>
        <div style={{ color }} className="font-semibold">{payload[0].value?.toFixed?.(2) ?? payload[0].value}{unit}</div>
      </div>
    )
  }
  return null
}

export default function RealtimeChart({ data, dataKey, label, unit, color = '#00FFC8', domain, warnLine, dangerLine, height = 90 }) {
  const latest = data.length > 0 ? data[data.length - 1]?.[dataKey] : null
  return (
    <div className="glass p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: color, opacity: 0.7 }} />
          <span className="text-xs font-mono tracking-widest uppercase" style={{ color: 'var(--muted)' }}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-semibold" style={{ color }}>
            {latest !== null && latest !== undefined ? `${typeof latest === 'number' ? latest.toFixed?.(2) ?? latest : latest}${unit}` : '—'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            LIVE
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,255,200,0.05)" />
          <XAxis dataKey="time" hide />
          <YAxis
            domain={domain || ['auto', 'auto']}
            tick={{ fontSize: 9, fill: '#5A7068', fontFamily: 'JetBrains Mono' }}
            width={28}
          />
          <Tooltip content={<CustomTooltip unit={unit} color={color} />} />
          {warnLine   && <ReferenceLine y={warnLine}   stroke="#FFB800" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />}
          {dangerLine && <ReferenceLine y={dangerLine} stroke="#FF3B3B" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />}
          <Area
            type="monotoneX"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
