import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await sql`
      SELECT 
        entry_id,
        user_id,
        ticker,
        decision,
        shadow_prediction,
        confidence,
        reason_text,
        strike_price,
        current_price,
        expiry_time,
        created_at,
        market_regime,
        volatility_level,
        risk_warnings
      FROM diary
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ entries: result.rows });
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    return NextResponse.json({ error: 'Failed to fetch diary entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'default',
      ticker = 'KXBTC15M',
      decision,
      shadowPrediction,
      confidence,
      reasonText,
      strikePrice,
      currentPrice,
      expiryTime,
      marketRegime,
      volatilityLevel,
      riskWarnings,
    } = body;

    const expiryTimestamp = expiryTime ? new Date(expiryTime).toISOString() : null;
    const riskWarningsJson = riskWarnings ? JSON.stringify(riskWarnings) : null;

    const result = await sql`
      INSERT INTO diary (
        user_id,
        ticker,
        decision,
        shadow_prediction,
        confidence,
        reason_text,
        strike_price,
        current_price,
        expiry_time,
        market_regime,
        volatility_level,
        risk_warnings
      ) VALUES (
        ${userId},
        ${ticker},
        ${decision},
        ${shadowPrediction},
        ${confidence},
        ${reasonText},
        ${strikePrice},
        ${currentPrice},
        ${expiryTimestamp},
        ${marketRegime},
        ${volatilityLevel},
        ${riskWarningsJson}
      )
      RETURNING entry_id, created_at
    `;

    return NextResponse.json({ 
      success: true, 
      entryId: result.rows[0].entry_id,
      createdAt: result.rows[0].created_at 
    });
  } catch (error) {
    console.error('Error creating diary entry:', error);
    return NextResponse.json({ error: 'Failed to create diary entry' }, { status: 500 });
  }
}
