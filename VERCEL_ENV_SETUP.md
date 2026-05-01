# Vercel Environment Variables Setup

The following secrets need to be moved from `.env.local` to Vercel's environment variables dashboard.

## Instructions

1. Go to your Vercel project dashboard: https://vercel.com/biiiigcees-9032s-projects/btc-trustee-quant-v3/settings/environment-variables
2. Add each variable below to the appropriate environment (Development, Preview, Production)
3. After adding to Vercel, remove the values from `.env.local` (keep the variable names as placeholders)

## Environment Variables to Add

### Vercel OIDC
- **VERCEL_OIDC_TOKEN**: (Current value in .env.local)
  - This is automatically managed by Vercel CLI, may not need manual migration

### AI API Keys
- **GROQ_API_KEY**: your_groq_key_here (placeholder - add actual key)
- **OPENAI_API_KEY**: your_openai_key_here (placeholder - add actual key)
- **ANTHROPIC_API_KEY**: your_anthropic_key_here (placeholder - add actual key)

### Novu Push Notifications
- **NOVU_API_KEY**: e25911c2aa388941ec49a1db00c98de8
- **NOVU_APP_ID**: OLkbW45584Wk
- **NOVU_SAFE_BET_TEMPLATE_ID**: safe-bet-alert

### Kalshi API
- **KALSHI_KEY_ID**: 72627bbd-54a5-4b73-b05b-541ca5df3745
- **KALSHI_PRIVATE_KEY**: (The full RSA private key from .env.local lines 21-47)

## After Migration

Once you've added these to Vercel, update `.env.local` to use placeholders:

```env
# AI API Keys
GROQ_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Novu Push Notifications
NOVU_API_KEY=
NOVU_APP_ID=
NOVU_SAFE_BET_TEMPLATE_ID=

# Kalshi API
KALSHI_KEY_ID=
KALSHI_PRIVATE_KEY=
```

Keep the VERCEL_OIDC_TOKEN as-is since it's managed by Vercel CLI.
