import axios from 'axios'

// ─────────────────────────────────────────────────────────────
//  DATA SOURCE CONFIGURATION
//
//  MODE 1 — CLOUD (default, works for anyone on the internet)
//    The React app reads from your deployed cloud backend.
//    Set VITE_CLOUD_BACKEND_URL in .env.local to your Render URL.
//    e.g.  VITE_CLOUD_BACKEND_URL=https://safetyhub-backend.onrender.com
//
//  MODE 2 — LOCAL (fallback, only works on ESP32 WiFi)
//    If no cloud URL is set, reads directly from ESP32 at 192.168.4.1
//    Useful for testing without deploying the backend.
// ─────────────────────────────────────────────────────────────

export const CLOUD_BACKEND_URL =
  import.meta.env.VITE_CLOUD_BACKEND_URL || null

export const DATA_MODE = CLOUD_BACKEND_URL ? 'cloud' : 'local'

// Local ESP32 direct URL (via Vite dev proxy)
const ESP32_URL = '/api/data'

/**
 * Fetch the latest sensor reading.
 * In cloud mode  → GET <backend>/latest
 * In local mode  → GET 192.168.4.1/api/data  (via Vite proxy)
 */
export async function fetchSensorData() {
  if (DATA_MODE === 'cloud') {
    const res = await axios.get(`${CLOUD_BACKEND_URL}/latest`, { timeout: 5000 })
    const data = res.data
    // Cloud API returns gasLevel (same key as ESP32)
    if (
      data.temperature === undefined ||
      data.humidity    === undefined ||
      data.gasLevel    === undefined ||
      data.vibration   === undefined
    ) {
      throw new Error('Unexpected response from cloud backend')
    }
    return data
  } else {
    // Local ESP32 direct
    const res = await axios.get(ESP32_URL, { timeout: 3000 })
    const data = res.data
    if (
      data.temperature === undefined ||
      data.humidity    === undefined ||
      data.gasLevel    === undefined ||
      data.vibration   === undefined
    ) {
      throw new Error('Unexpected response format from ESP32')
    }
    return data
  }
}

/**
 * Fetch historical readings from cloud backend.
 * Returns [] in local mode (no history available without cloud).
 */
export async function fetchHistory(limit = 30) {
  if (!CLOUD_BACKEND_URL) return []
  try {
    const res = await axios.get(`${CLOUD_BACKEND_URL}/history?limit=${limit}`, { timeout: 5000 })
    return res.data.readings || []
  } catch {
    return []
  }
}

/**
 * Fetch alert history from cloud backend.
 * Returns [] in local mode.
 */
export async function fetchAlertHistory(limit = 50) {
  if (!CLOUD_BACKEND_URL) return []
  try {
    const res = await axios.get(`${CLOUD_BACKEND_URL}/alerts?limit=${limit}`, { timeout: 5000 })
    return res.data.alerts || []
  } catch {
    return []
  }
}

/**
 * Fetch aggregate stats from cloud backend.
 * Returns null in local mode.
 */
export async function fetchStats() {
  if (!CLOUD_BACKEND_URL) return null
  try {
    const res = await axios.get(`${CLOUD_BACKEND_URL}/stats`, { timeout: 5000 })
    return res.data
  } catch {
    return null
  }
}

/**
 * Open a Server-Sent Events stream from cloud backend.
 * Returns an EventSource in cloud mode, null in local mode.
 * The caller must handle .onmessage and .onerror
 */
export function openSSEStream() {
  if (!CLOUD_BACKEND_URL) return null
  return new EventSource(`${CLOUD_BACKEND_URL}/stream`)
}
