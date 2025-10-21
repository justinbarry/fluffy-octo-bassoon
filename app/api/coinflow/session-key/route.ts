import { NextResponse } from 'next/server';
import { validateWallet } from '@/utils/apiHelpers';
import { COINFLOW_URL, getCoinflowHeaders } from '@/utils/coinflowApi';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  console.log('Session Key API called with wallet:', wallet);

  // Validate wallet
  const validation = validateWallet(wallet);
  if (!validation.isValid) {
    return validation.error;
  }

  try {
    const url = `${COINFLOW_URL()}/auth/session-key`;
    console.log('Calling Coinflow API:', url);

    // Use centralized header function but customize for session-key endpoint
    const headers = getCoinflowHeaders(null, wallet!);

    // For session-key, we need the Authorization header in the Authorization field, not x-coinflow-api-key
    const sessionKeyHeaders = {
      'Authorization': headers['x-coinflow-api-key'],
      'Accept': 'application/json',
      'x-coinflow-auth-blockchain': 'base',
      'x-coinflow-auth-wallet': wallet!
    };

    console.log('Headers:', sessionKeyHeaders);

    const response = await fetch(url, {
      headers: sessionKeyHeaders
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Raw response:', text);

    if (!response.ok) {
      throw new Error(`Failed to get session key: ${text}`);
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      return NextResponse.json({
        error: 'Invalid JSON response from Coinflow',
        rawResponse: text.slice(0, 500)
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Error in Session Key API:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json({
      error: 'Failed to get session key',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
