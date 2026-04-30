import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  if (!process.env.POSTGRES_URL) {
    return NextResponse.json(
      { error: 'Missing env var: POSTGRES_URL' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await sql`
      SELECT 
        bet_id,
        user_id,
        ticker,
        bet_type,
        contract_type,
        strike_price,
        amount,
        entry_price,
        outcome,
        payout,
        settlement_price,
        confidence,
        expiry_time,
        created_at
      FROM bets
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ bets: result.rows });
  } catch (error) {
    console.error('Error fetching bets:', error);
    return NextResponse.json({ error: 'Failed to fetch bets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.POSTGRES_URL) {
    return NextResponse.json(
      { error: 'Missing env var: POSTGRES_URL' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      userId = 'default',
      ticker = 'KXBTC15M',
      betType,
      contractType,
      strikePrice,
      amount,
      entryPrice,
      confidence,
      expiryTime,
    } = body;

    const expiryTimestamp = new Date(expiryTime).toISOString();

    const result = await sql`
      INSERT INTO bets (
        user_id,
        ticker,
        bet_type,
        contract_type,
        strike_price,
        amount,
        entry_price,
        confidence,
        expiry_time,
        outcome
      ) VALUES (
        ${userId},
        ${ticker},
        ${betType},
        ${contractType},
        ${strikePrice},
        ${amount},
        ${entryPrice},
        ${confidence},
        ${expiryTimestamp},
        'PENDING'
      )
      RETURNING bet_id, created_at
    `;

    return NextResponse.json({ 
      success: true, 
      betId: result.rows[0].bet_id,
      createdAt: result.rows[0].created_at 
    });
  } catch (error) {
    console.error('Error creating bet:', error);
    return NextResponse.json({ error: 'Failed to create bet' }, { status: 500 });
  }
}
