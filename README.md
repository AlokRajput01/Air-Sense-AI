# AirSense AI

AirSense AI combines air quality, weather, and active fire data to help people understand local environmental conditions. This project was developed for SIH26082. See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and data flow.

## Features

- Nearby air quality stations and pollutant observations from OpenAQ API v3
- Current weather from OpenWeather and active fire detections from NASA FIRMS
- Forecast, inversion, health risk, and recommendation endpoints
- Browser alerts for AQI and PM2.5 thresholds; alert settings are saved in the current browser
- Location based views using the place selected in the app

The application displays missing credentials, unavailable stations, provider errors, and unapproved forecasts as unavailable. It does not invent observations or AQI values. Browser alerts are checked while the app is open and are not sent as push notifications.

## Requirements

- Python 3.11 or later
- Node.js 20 or later
- API keys for OpenAQ, OpenWeather, and NASA FIRMS
- MongoDB for database-backed features and readiness checks

## Run locally

### 1. Configure the backend

From the project root, open a terminal and run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item ..\.env.example .env
```

Edit `backend/.env` and set `OPENAQ_API_KEY`, `OPENWEATHER_API_KEY`, `NASA_FIRMS_MAP_KEY`, and `MONGODB_URI`. The example MongoDB URI points to a local MongoDB server; replace it with your deployment URI if needed.

Start the API:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The interactive API documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Configure the frontend

Open a second terminal from the project root and run:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL shown in the terminal, usually [http://localhost:5173](http://localhost:5173). The development server proxies `/api` requests to the backend. Select a place in the location bar to load data for that location.

## API endpoints

- `GET /api/air-quality?lat=<latitude>&lon=<longitude>` — current observations from the nearest available station
- `GET /api/air-quality/history?lat=<latitude>&lon=<longitude>&days=7` — historical observations (1–90 days)
- `GET /api/weather` — current weather
- `GET /api/fire-hotspots` — active fire detections
- `GET /api/forecast` — forecast data when an approved model is available
- `GET /api/inversion` — inversion conditions
- `GET /api/health-risk` — general health guidance
- `GET /api/recommendations` — evidence based recommendations

OpenAQ API v3 requires an API key in the `X-API-Key` header. Forecasts remain unavailable until a validated model artifact is approved and deployed.

## Deployment

Use HTTPS, private MongoDB networking, deployment managed secrets, provider specific rate limits, a configured CORS allowlist, monitored data freshness, backups, and a reviewed data retention policy. Government functions require deployment authentication and role based access control; the included dashboard is informational.

Never commit local `.env` files or real API keys. Use `.env.example` as a template and replace its placeholders locally.
