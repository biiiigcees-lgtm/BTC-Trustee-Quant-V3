-- Prediction Tracking Database Schema
-- Run this in your Vercel Postgres database

-- Main predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  prediction_id UUID DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL,
  strike_price DECIMAL(18, 8) NOT NULL,
  current_price DECIMAL(18, 8) NOT NULL,
  expiry_label VARCHAR(50),
  seconds_to_expiry INTEGER,
  verdict VARCHAR(10) NOT NULL CHECK (verdict IN ('ABOVE', 'BELOW', 'PASS')),
  confidence INTEGER NOT NULL CHECK (confidence >= 50 AND confidence <= 99),
  ev INTEGER,
  kelly DECIMAL(5, 2),
  reasoning TEXT[],
  providers_used TEXT[],
  model_votes TEXT[],
  model_agreement INTEGER,
  ensemble_confidence INTEGER,
  latency_ms INTEGER,
  -- Trajectory data
  moves_needed DECIMAL(8, 2),
  velocity DECIMAL(12, 4),
  projected_outcome VARCHAR(10),
  momentum_dir TEXT,
  -- Input data snapshot
  rsi DECIMAL(5, 2),
  ema9 DECIMAL(18, 8),
  ema21 DECIMAL(18, 8),
  macd_macd DECIMAL(10, 4),
  macd_signal DECIMAL(10, 4),
  macd_histogram DECIMAL(10, 4),
  bb_upper DECIMAL(18, 8),
  bb_lower DECIMAL(18, 8),
  bb_pctb DECIMAL(5, 4),
  atr DECIMAL(10, 4),
  funding_rate DECIMAL(10, 6),
  fear_greed INTEGER,
  market_regime VARCHAR(50),
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_ip INET,
  user_agent TEXT
);

-- Outcome tracking (requires manual or automated resolution)
CREATE TABLE IF NOT EXISTS prediction_outcomes (
  id SERIAL PRIMARY KEY,
  prediction_id UUID REFERENCES predictions(prediction_id),
  actual_outcome VARCHAR(10) CHECK (actual_outcome IN ('ABOVE', 'BELOW', 'EXPIRED')),
  final_price DECIMAL(18, 8),
  resolved_at TIMESTAMP WITH TIME ZONE,
  was_correct BOOLEAN,
  profit_loss DECIMAL(18, 8),
  resolution_source VARCHAR(50) -- 'kalshi', 'manual', 'api'
);

-- Provider performance tracking
CREATE TABLE IF NOT EXISTS provider_stats (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  model_id VARCHAR(100),
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5, 2),
  avg_latency_ms INTEGER,
  avg_confidence DECIMAL(5, 2),
  total_cost_usd DECIMAL(10, 4),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, model_id)
);

-- Daily aggregated stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol VARCHAR(10) NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5, 2),
  avg_confidence DECIMAL(5, 2),
  avg_latency_ms INTEGER,
  total_cost_usd DECIMAL(10, 4),
  UNIQUE(date, symbol)
);

-- A/B test results
CREATE TABLE IF NOT EXISTS ab_tests (
  id SERIAL PRIMARY KEY,
  test_name VARCHAR(100) NOT NULL,
  variant_a_name VARCHAR(50) NOT NULL,
  variant_b_name VARCHAR(50) NOT NULL,
  variant_a_predictions INTEGER DEFAULT 0,
  variant_b_predictions INTEGER DEFAULT 0,
  variant_a_correct INTEGER DEFAULT 0,
  variant_b_correct INTEGER DEFAULT 0,
  variant_a_accuracy DECIMAL(5, 2),
  variant_b_accuracy DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON predictions(symbol);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_predictions_verdict ON predictions(verdict);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_prediction_id ON prediction_outcomes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- Views for easy querying
CREATE OR REPLACE VIEW prediction_accuracy AS
SELECT 
  p.symbol,
  p.verdict,
  COUNT(*) as total,
  COUNT(po.was_correct) as resolved,
  SUM(CASE WHEN po.was_correct = true THEN 1 ELSE 0 END) as correct,
  ROUND(100.0 * SUM(CASE WHEN po.was_correct = true THEN 1 ELSE 0 END) / NULLIF(COUNT(po.was_correct), 0), 2) as accuracy_pct,
  AVG(p.confidence) as avg_confidence,
  AVG(po.profit_loss) as avg_pnl
FROM predictions p
LEFT JOIN prediction_outcomes po ON p.prediction_id = po.prediction_id
GROUP BY p.symbol, p.verdict;

CREATE OR REPLACE VIEW provider_performance AS
SELECT
  provider,
  model_id,
  total_predictions,
  correct_predictions,
  accuracy_rate,
  avg_latency_ms,
  total_cost_usd,
  CASE
    WHEN total_predictions > 0 THEN ROUND(total_cost_usd / total_predictions, 4)
    ELSE 0
  END as cost_per_prediction
FROM provider_stats
ORDER BY accuracy_rate DESC NULLS LAST;

-- BTC-Trustee-Quant-V3: Bets ledger for KXBTC15M contracts
CREATE TABLE IF NOT EXISTS bets (
  id SERIAL PRIMARY KEY,
  bet_id UUID DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  ticker VARCHAR(20) NOT NULL DEFAULT 'KXBTC15M',
  bet_type VARCHAR(10) NOT NULL CHECK (bet_type IN ('YES', 'NO')),
  contract_type VARCHAR(10) NOT NULL CHECK (contract_type IN ('ABOVE', 'BELOW')),
  strike_price DECIMAL(18, 8) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  entry_price DECIMAL(18, 8) NOT NULL,
  outcome VARCHAR(20) CHECK (outcome IN ('WIN', 'LOSS', 'PENDING', 'CANCELLED')),
  payout DECIMAL(18, 8),
  settlement_price DECIMAL(18, 8),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- BRTI settlement data
  brti_60s_avg DECIMAL(18, 8),
  brti_data_source VARCHAR(50)
);

-- BTC-Trustee-Quant-V3: Secret diary for HOLD decisions
CREATE TABLE IF NOT EXISTS diary (
  id SERIAL PRIMARY KEY,
  entry_id UUID DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  ticker VARCHAR(20) NOT NULL DEFAULT 'KXBTC15M',
  decision VARCHAR(10) NOT NULL CHECK (decision IN ('HOLD', 'PASS')),
  shadow_prediction VARCHAR(10) CHECK (shadow_prediction IN ('ABOVE', 'BELOW')),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  reason_text TEXT NOT NULL,
  strike_price DECIMAL(18, 8),
  current_price DECIMAL(18, 8),
  expiry_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Additional context
  market_regime VARCHAR(50),
  volatility_level VARCHAR(20),
  risk_warnings TEXT[]
);

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_ticker ON bets(ticker);
CREATE INDEX IF NOT EXISTS idx_bets_outcome ON bets(outcome);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at);
CREATE INDEX IF NOT EXISTS idx_bets_expiry_time ON bets(expiry_time);
CREATE INDEX IF NOT EXISTS idx_diary_user_id ON diary(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_ticker ON diary(ticker);
CREATE INDEX IF NOT EXISTS idx_diary_created_at ON diary(created_at);

-- View for bet performance summary
CREATE OR REPLACE VIEW bet_performance AS
SELECT
  user_id,
  ticker,
  COUNT(*) as total_bets,
  SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
  SUM(CASE WHEN outcome = 'PENDING' THEN 1 ELSE 0 END) as pending,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN outcome IN ('WIN', 'LOSS') THEN 1 ELSE 0 END), 0), 2) as win_rate_pct,
  SUM(CASE WHEN outcome = 'WIN' THEN payout ELSE 0 END) as total_payout,
  SUM(amount) as total_invested,
  SUM(CASE WHEN outcome = 'WIN' THEN payout ELSE -amount END) as net_profit_loss
FROM bets
GROUP BY user_id, ticker;  
