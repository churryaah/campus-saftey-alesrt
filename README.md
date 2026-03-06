# SafetyHub Cloud — Campus Emergency Monitoring System

> ESP32 sensors → Laptop gateway → Cloud API → PostgreSQL → Public dashboard

---

## System Architecture

```
MPU6050 / MQ2 / DHT11
          │
          ▼
       ESP32
  (192.168.4.1/api/data)
          │  GET every 2 s
          ▼
   gateway/gateway.py
     (your laptop)
          │  POST /sensor-data every 2 s
          ▼
  backend/main.py  ──────────────────────┐
  (FastAPI on Render)                    │
          │                              │
          ├── PostgreSQL Database        │
          │   (Render managed)           │
          │                             SSE
          ├── REST API                   │
          │   GET /latest                │
          │   GET /history               │
          │   GET /alerts                │
          │   GET /stats                 │
          │   GET /health                │
          │                              │
          └── GET /stream ───────────────┘
                  │
                  ▼
     dashboard/index.html
     (deployed on Vercel/Netlify)
     accessible to anyone on internet
```

---

## Folder Structure

```
safetyhub-cloud/
├── backend/
│   ├── main.py          ← FastAPI app (all endpoints + SSE)
│   ├── database.py      ← SQLAlchemy async engine + session
│   ├── models.py        ← ORM table: sensor_data
│   ├── schemas.py       ← Pydantic request/response models
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── templates/
│       └── dashboard.html  ← Standalone public dashboard
│
├── gateway/
│   ├── gateway.py       ← Laptop polling agent
│   ├── requirements.txt
│   └── .env.example
│
├── render.yaml          ← One-click Render deployment
├── .gitignore
└── README.md
```

---

## API Endpoints

| Method | Endpoint        | Description                          |
|--------|-----------------|--------------------------------------|
| POST   | /sensor-data    | Gateway pushes readings here         |
| GET    | /latest         | Latest sensor snapshot               |
| GET    | /history        | Paginated history (limit/offset/hours)|
| GET    | /alerts         | All hazard alert events              |
| GET    | /stats          | Aggregate stats (avg, max, min)      |
| GET    | /health         | Backend + DB + gateway status        |
| GET    | /stream         | Server-Sent Events realtime feed     |
| GET    | /docs           | Interactive Swagger UI               |

---

## Part 1 — Local Development Setup

### 1. Install backend dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — for local dev, SQLite is used automatically.
# No DATABASE_URL needed locally.
```

### 3. Run backend locally

```bash
cd backend
python main.py
```

Backend is now running at: **http://localhost:8000**

Test it:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/latest
```

Swagger UI: http://localhost:8000/docs

### 4. Configure gateway

```bash
cd gateway
cp .env.example .env
```

Edit `gateway/.env`:
```
ESP32_URL=http://192.168.4.1/api/data
BACKEND_URL=http://localhost:8000        # local dev
POLL_INTERVAL=2.0
```

### 5. Connect laptop to ESP32 WiFi

Connect to WiFi: **SafetyHub** (password: `safetyhub123`)

### 6. Run gateway

```bash
cd gateway
pip install -r requirements.txt
python gateway.py
```

You should see:
```
09:41:00  INFO  SafetyHub Gateway v2 starting
09:41:00  INFO  ESP32   → http://192.168.4.1/api/data
09:41:00  INFO  Backend → http://localhost:8000
09:41:02  INFO  ESP32 ✓ | temp=31.5 hum=67.2 gas=410 vib=0.720
```

### 7. Test the full pipeline

```bash
# Latest reading from database:
curl http://localhost:8000/latest

# Last 10 readings:
curl "http://localhost:8000/history?limit=10"

# Alert events:
curl http://localhost:8000/alerts

# SSE stream (keep open — you'll see data every 2 s):
curl -N http://localhost:8000/stream
```

---

## Part 2 — Cloud Deployment on Render

### Step 1: Push to GitHub

```bash
cd safetyhub-cloud
git init
git add .
git commit -m "Initial SafetyHub cloud backend"
git remote add origin https://github.com/YOUR_USERNAME/safetyhub-cloud.git
git push -u origin main
```

### Step 2: Deploy to Render (automatic)

1. Go to **https://dashboard.render.com**
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render reads `render.yaml` and creates:
   - **safetyhub-backend** web service (FastAPI)
   - **safetyhub-db** PostgreSQL database (free tier)
5. Click **Apply**
6. Wait ~3 minutes for deployment

Your backend is now live at:
```
https://safetyhub-backend.onrender.com
```

### Step 3: Test production backend

```bash
curl https://safetyhub-backend.onrender.com/health
```

Expected:
```json
{
  "status": "ok",
  "database": "connected",
  "gateway_active": false,
  "sse_clients": 0,
  "last_reading": null,
  "timestamp": "2025-..."
}
```

### Step 4: Update gateway to point to cloud

Edit `gateway/.env`:
```
BACKEND_URL=https://safetyhub-backend.onrender.com
```

Or run directly:
```bash
python gateway.py --backend https://safetyhub-backend.onrender.com
```

Now data flows: ESP32 → laptop → Render cloud → PostgreSQL

---

## Part 3 — Deploy the Public Dashboard

The dashboard is a single HTML file at `backend/templates/dashboard.html`.
It only needs a static file host — no server required.

### Option A: Vercel (recommended)

1. Create a new folder `public/` and copy `dashboard.html` into it as `index.html`
2. Edit the `BACKEND_URL` constant inside the HTML:
   ```javascript
   const BACKEND_URL = 'https://safetyhub-backend.onrender.com'
   ```
3. Push to GitHub
4. Go to **https://vercel.com** → Import Git Repository
5. Set output directory to `public/`
6. Deploy

Your dashboard is live at:
```
https://safetyhub-dashboard.vercel.app
```

### Option B: Netlify

1. Drag and drop the `dashboard.html` file to **https://app.netlify.com/drop**
2. Done — you get a live URL instantly.

### Option C: GitHub Pages

1. Create a repo named `safetyhub-dashboard`
2. Put `dashboard.html` as `index.html`
3. Enable GitHub Pages in Settings → Pages → main branch
4. Live at: `https://YOUR_USERNAME.github.io/safetyhub-dashboard`

---

## Part 4 — Connecting ESP32 After Deployment

The ESP32 firmware does NOT need any changes.

The gateway on your laptop is the only piece that talks to the ESP32.
The gateway then pushes to the cloud.

**Daily workflow:**
1. Power on ESP32
2. Connect laptop to `SafetyHub` WiFi
3. Run: `python gateway.py --backend https://safetyhub-backend.onrender.com`
4. Anyone with the dashboard URL can now see live data

---

## Database Schema

```sql
CREATE TABLE sensor_data (
    id          BIGINT PRIMARY KEY AUTOINCREMENT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    temperature FLOAT   NOT NULL,   -- °C from DHT11
    humidity    FLOAT   NOT NULL,   -- % RH from DHT11
    gas_level   INTEGER NOT NULL,   -- ADC 0-4095 from MQ2
    vibration   FLOAT   NOT NULL,   -- G-force from MPU6050
    alert       VARCHAR(120) NOT NULL DEFAULT 'System Normal'
);

CREATE INDEX ix_sensor_data_timestamp ON sensor_data(timestamp DESC);
CREATE INDEX ix_sensor_data_alert_ts  ON sensor_data(alert, timestamp);
```

---

## Environment Variables

| Variable         | Where      | Description                                  |
|------------------|------------|----------------------------------------------|
| `DATABASE_URL`   | backend    | PostgreSQL connection string (Render injects automatically) |
| `GATEWAY_API_KEY`| backend    | Secret for gateway auth (optional)           |
| `PORT`           | backend    | HTTP port (default 8000, Render sets this)   |
| `ESP32_URL`      | gateway    | ESP32 API endpoint                           |
| `BACKEND_URL`    | gateway    | Cloud backend URL                            |
| `POLL_INTERVAL`  | gateway    | Seconds between ESP32 polls (default 2.0)    |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `Connection refused` on gateway startup | Ensure laptop is on SafetyHub WiFi |
| `422 Unprocessable Entity` on POST | Check ESP32 JSON has all 5 required fields |
| Dashboard shows `—` values | Wait for first gateway push; check backend URL |
| Render deploy fails | Check build logs; ensure `requirements.txt` is in `backend/` |
| SSE disconnects frequently | Normal on free Render tier (30s idle timeout) — dashboard auto-reconnects |
| `DATABASE_URL` error locally | Leave it unset — SQLite is used automatically |

---

## Free Tier Limitations (Render)

| Feature | Free Tier |
|---|---|
| Web service | Sleeps after 15 min idle |
| PostgreSQL | 1 GB storage, 90 day retention |
| Bandwidth | 100 GB/month |
| Uptime | ~750 hours/month |

> **Tip:** Upgrade to Starter ($7/month) for always-on service without sleep.
> The gateway keeps the service awake as long as it's running.
