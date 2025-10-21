import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, handleApiError, getCoinflowHeaders, COINFLOW_URL } from '@/utils/coinflowApi';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, sessionKey, signature, message } = body;

    if (!wallet) {
      return createErrorResponse('Wallet address is required');
    }

    if (!sessionKey) {
      return createErrorResponse('Session key is required');
    }

    if (!signature) {
      return createErrorResponse('Signature is required');
    }

    if (!message) {
      return createErrorResponse('Message is required');
    }

    console.log('Submitting gasless EVM transaction to Coinflow:', {
      wallet,
      hasSignature: !!signature,
      hasMessage: !!message
    });

    // Submit the signed permit message to Coinflow for gasless withdrawal
    const response = await fetch(`${COINFLOW_URL()}/withdraw/evm/transaction`, {
      method: 'POST',
      headers: {
        ...getCoinflowHeaders(sessionKey, wallet),
        'x-coinflow-auth-blockchain': 'base'
      },
      body: JSON.stringify({
        signature,
        message,
        blockchain: 'base'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Coinflow gasless transaction error:', error);
      return createErrorResponse(`Failed to submit gasless transaction: ${JSON.stringify(error)}`, response.status);
    }

    const data = await response.json();
    console.log('Gasless transaction submitted successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Error submitting gasless transaction');
  }
}
