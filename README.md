# PulseWatch: Real-Time Crypto Alert & AI Insights Engine

PulseWatch is a high-performance, real-time cryptocurrency watchlist and alerting platform. It streams live prices from Binance WebSockets, aggregates candles, evaluates custom technical indicator alerts (price, volume, RSI, and moving averages) in a BullMQ background worker queue, and delivers live notifications alongside AI-generated market insights.

---

## 🏗️ Project Architecture & Monorepo Structure

This project is organized as a modular TypeScript monorepo using **pnpm workspaces**:

```
├── apps
│   ├── api              # Fastify Server + Socket.io + Ingestion + Background Workers
│   └── web              # Vite + React + Tailwind CSS client dashboard
├── packages
│   └── shared           # Zod validation schemas, Shared constants, and types
├── package.json         # Workspace root scripts
└── pnpm-workspace.yaml  # Monorepo workspaces definition
```

---

## ⚙️ Services & Entrypoints

The backend is composed of **three separate Node processes** running concurrently:

1. **API Server (`apps/api/src/server.ts`)**: Relays real-time price feeds via Socket.io using a Redis adapter, manages authentication/JWTs, handles watchlists, and exposes CRUD endpoints.
2. **Ingestion Service (`apps/api/src/ingestion.ts`)**: Subscribes directly to Binance trade stream WebSockets, parses trades, persists aggregate 1-minute OHLCV candles to PostgreSQL, and caches instant ticks in Redis.
3. **Alert Workers (`apps/api/src/worker.ts`)**: Repeatable BullMQ workers scheduled to evaluate active rules every 10 seconds against real-time conditions (Price, Volume, RSI, MA) and post notifications to Redis and DB.

---

## 🚀 Local Setup & Development

### 1. Requirements
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (>= 18)
- [pnpm](https://pnpm.io/)
- PostgreSQL & Redis (locally running or Docker containers)

### 2. Install Dependencies
Run from the monorepo root:
```bash
pnpm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<db_name>
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
API_PORT=3001
CORS_ORIGIN=http://localhost:5173
# Optional: ANTHROPIC_API_KEY=your_key
```

### 4. Database Migrations & Seeding
Compile the codebase and run migrations to construct schemas and seed default pairs (like BTCUSDT, ETHUSDT):
```bash
pnpm run build
pnpm run db:migrate
pnpm run db:seed
```

### 5. Launch Development Servers
You can run all services concurrently in development mode using root-level npm scripts:

* **Start API server**: `pnpm run dev:api`
* **Start Ingestion service**: `pnpm run dev:ingestion`
* **Start Alert Worker**: `pnpm run dev:worker`
* **Start Web dashboard**: `pnpm run dev:web`