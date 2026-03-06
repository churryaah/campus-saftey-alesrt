import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchSensorData,
  fetchHistory,
  fetchAlertHistory,
  fetchStats,
  openSSEStream,
  DATA_MODE,
  CLOUD_BACKEND_URL,
} from '../services/sensorService'

const MAX_CHART_POINTS  = 30
const MAX_ALERT_HISTORY = 100
const POLL_INTERVAL     = 2000   // used only in local/fallback mode

export default function useSensorData() {
  const [current, setCurrent]         = useState(null)
  const [history, setHistory]         = useState([])
  const [alertLog, setAlertLog]       = useState([])
  const [status, setStatus]           = useState('connecting')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [alertActive, setAlertActive] = useState(false)
  const [error, setError]             = useState(null)
  const [pollCount, setPollCount]     = useState(0)
  const [uptime, setUptime]           = useState(0)
  const [cloudStats, setCloudStats]   = useState(null)
  const [dataMode]                    = useState(DATA_MODE)

  const lastAlertRef = useRef(null)
  const uptimeRef    = useRef(null)
  const intervalRef  = useRef(null)
  const sseRef       = useRef(null)

  // ── Uptime counter ────────────────────────────────────────
  const startUptime = useCallback(() => {
    if (uptimeRef.current) return
    uptimeRef.current = setInterval(() => setUptime(s => s + 1), 1000)
  }, [])
  const stopUptime = useCallback(() => {
    clearInterval(uptimeRef.current)
    uptimeRef.current = null
  }, [])

  // ── Process one reading (shared between SSE + polling) ───
  const processReading = useCallback((data, ts = new Date()) => {
    setCurrent(data)
    setLastUpdated(ts)
    setStatus('online')
    setError(null)
    setPollCount(c => c + 1)
    startUptime()

    const isAlert = data.alert && data.alert !== 'System Normal'
    setAlertActive(isAlert)

    // Deduplicated alert log — only add when message changes
    if (data.alert !== lastAlertRef.current) {
      lastAlertRef.current = data.alert
      const event = {
        id:          ts.getTime(),
        alert:       data.alert,
        time:        ts.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timeDisplay: ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        dateDisplay: ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isNormal:    !isAlert,
        temperature: data.temperature,
        humidity:    data.humidity,
        gasLevel:    data.gasLevel,
        vibration:   data.vibration,
      }
      setAlertLog(prev => {
        const next = [event, ...prev]
        return next.length > MAX_ALERT_HISTORY ? next.slice(0, MAX_ALERT_HISTORY) : next
      })
    }

    // Rolling chart history
    setHistory(prev => {
      const entry = {
        ...data,
        time: ts.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }
      const next = [...prev, entry]
      return next.length > MAX_CHART_POINTS ? next.slice(next.length - MAX_CHART_POINTS) : next
    })
  }, [startUptime])

  // ── Fallback poll (used when SSE fails or in local mode) ──
  const poll = useCallback(async () => {
    try {
      const data = await fetchSensorData()
      processReading(data)
    } catch {
      setStatus('offline')
      setError(
        DATA_MODE === 'cloud'
          ? `Cloud backend unreachable — ${CLOUD_BACKEND_URL}`
          : 'ESP32 Offline — Cannot reach 192.168.4.1'
      )
      stopUptime()
    }
  }, [processReading, stopUptime])

  // ── SSE connection (cloud mode only) ─────────────────────
  const connectSSE = useCallback(() => {
    if (DATA_MODE !== 'cloud') return

    const es = openSSEStream()
    if (!es) return
    sseRef.current = es

    es.onopen = () => {
      setStatus('online')
      setError(null)
      // Stop polling interval — SSE handles updates now
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        processReading(data, new Date(data.timestamp || Date.now()))
      } catch { /* ignore malformed */ }
    }

    es.onerror = () => {
      setStatus('offline')
      setError('Cloud stream disconnected — reconnecting…')
      stopUptime()
      es.close()
      sseRef.current = null
      // Fall back to polling while SSE reconnects
      if (!intervalRef.current) {
        intervalRef.current = setInterval(poll, POLL_INTERVAL)
      }
      // Try to reconnect SSE after 5 s
      setTimeout(connectSSE, 5000)
    }
  }, [processReading, poll, stopUptime])

  // ── Bootstrap: load history then connect ─────────────────
  useEffect(() => {
    ;(async () => {
      // Pre-load chart history from cloud DB on first mount
      if (DATA_MODE === 'cloud') {
        const cloudHistory = await fetchHistory(30)
        if (cloudHistory.length > 0) {
          const mapped = cloudHistory.reverse().map(d => ({
            ...d,
            time: new Date(d.timestamp).toLocaleTimeString('en-US', {
              hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
            }),
          }))
          setHistory(mapped)

          // Show latest reading immediately (before SSE connects)
          const latest = mapped[mapped.length - 1]
          if (latest) processReading(latest, new Date(latest.timestamp || Date.now()))
        }

        // Pre-load alert log from cloud DB
        const cloudAlerts = await fetchAlertHistory(50)
        if (cloudAlerts.length > 0) {
          const mapped = cloudAlerts.map(a => ({
            id:          new Date(a.timestamp).getTime(),
            alert:       a.alert,
            time:        new Date(a.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timeDisplay: new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            dateDisplay: new Date(a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isNormal:    false,
            temperature: a.temperature,
            humidity:    a.humidity,
            gasLevel:    a.gasLevel,
            vibration:   a.vibration,
          }))
          setAlertLog(mapped)
        }

        // Load aggregate stats
        const stats = await fetchStats()
        if (stats) setCloudStats(stats)

        // Connect realtime SSE
        connectSSE()
      } else {
        // Local mode — just poll
        poll()
        intervalRef.current = setInterval(poll, POLL_INTERVAL)
      }
    })()

    return () => {
      clearInterval(intervalRef.current)
      clearInterval(uptimeRef.current)
      sseRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh cloud stats every 30 s
  useEffect(() => {
    if (DATA_MODE !== 'cloud') return
    const t = setInterval(async () => {
      const stats = await fetchStats()
      if (stats) setCloudStats(stats)
    }, 30_000)
    return () => clearInterval(t)
  }, [])

  return {
    current, history, alertLog,
    status, lastUpdated, alertActive, error,
    pollCount, uptime, cloudStats, dataMode,
  }
}
