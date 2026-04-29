# BTC-Trustee-Quant-V3

A comprehensive trading indicator dashboard integrating Kalshi 15-minute binary contracts with BRTI settlement, real-time Binance and Kraken WebSocket feeds, backtest engine, database schema for bets and diary, Novu push notifications, and a Bloomberg-style frontend UI.

## Features

- **Kalshi KXBTC15M Integration**: 15-minute binary BTC contracts with JWT signature authentication
- **BRTI Settlement**: 60-second CME CF Bitcoin Real-Time Index calculation with Coinbase fallback
- **Real-time Data**: Binance USDM Futures and Kraken Spot WebSocket APIs with sub-50ms latency
- **Backtest Engine**: Historical market simulation with synthetic data fallback
- **Database**: PostgreSQL schema for bets and diary with performance views
- **Notifications**: Novu push notification integration for safe bet alerts
- **Frontend**: Bloomberg-style terminal UI with real-time forecast display
- **User Controls**: Target price input, override buttons, and manual trading controls

## Tech Stack

- **Frontend**: Next.js 16.2.3, React 18, Tailwind CSS 4.2.0
- **Database**: Vercel Postgres
- **Real-time**: Socket.io, WebSocket (Binance, Kraken)
- **Notifications**: Novu
- **Authentication**: Kalshi JWT (RS256)
- **State Management**: Zustand
- **Charts**: Lightweight Charts, Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Vercel Postgres recommended)
- Kalshi API credentials (Key ID, Private Key)
- Novu API credentials (API Key, App ID)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

```env
# Database
POSTGRES_URL=your_postgres_url
POSTGRES_PRISMA_URL=your_prisma_url

# Kalshi API
KALSHI_KEY_ID=your_key_id
KALSHI_PRIVATE_KEY=your_private_key

# Novu Notifications
NOVU_API_KEY=your_novu_api_key
NOVU_APP_ID=your_novu_app_id

# CF Benchmarks (optional)
CF_BENCHMARKS_API_KEY=your_api_key

# AI APIs (optional)
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm start
```

## API Routes

- `GET/POST /api/bets` - Manage trading bets
- `GET/POST /api/diary` - Secret diary entries
- `GET /api/prices` - Real-time price data
- `POST /api/predict` - AI predictions

## Components

- `Kxbtc15mTimer` - Contract expiry countdown
- `BetsLedger` - Trading history display
- `DiaryView` - Secret diary component
- `ForecastDisplay` - Real-time AI forecast
- `TradeControls` - User trading interface

## Database Schema

### Bets Table
- bet_id, user_id, ticker, bet_type, contract_type
- strike_price, amount, entry_price, outcome, payout
- confidence, expiry_time, created_at

### Diary Table
- entry_id, user_id, ticker, decision, shadow_prediction
- confidence, reason_text, strike_price, current_price
- expiry_time, market_regime, volatility_level, risk_warnings

## Security

- JWT signature authentication for Kalshi API
- Environment variable protection
- SQL injection prevention with parameterized queries
- Snyk security scanning (0 vulnerabilities)

## License

MIT
