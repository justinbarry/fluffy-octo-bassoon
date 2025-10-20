import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, handleApiError, getCoinflowHeaders, COINFLOW_URL } from '@/utils/coinflowApi';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, sessionKey, hash } = body;

    if (!wallet) {
      return createErrorResponse('Wallet address is required');
    }

    if (!sessionKey) {
      return createErrorResponse('Session key is required');
    }

    if (!hash) {
      return createErrorResponse('Transaction hash is required');
    }

    console.log('Submitting transaction hash to Coinflow:', {
      wallet,
      hash
    });

    // Submit transaction hash to Coinflow
    const response = await fetch(`${COINFLOW_URL()}/transaction`, {
      method: 'POST',
      headers: {
        ...getCoinflowHeaders(sessionKey, wallet),
        'x-coinflow-auth-blockchain': 'base'
      },
      body: JSON.stringify({
        hash,
        blockchain: 'base'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Coinflow hash submission error:', error);
      return createErrorResponse(`Failed to submit transaction hash: ${JSON.stringify(error)}`, response.status);
    }

    const data = await response.json();
    console.log('Transaction hash submitted successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Error submitting transaction hash');
  }
}
