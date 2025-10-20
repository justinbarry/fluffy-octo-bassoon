import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, handleApiError, getCoinflowHeaders, COINFLOW_URL, COINFLOW_MERCHANT_ID } from '@/utils/coinflowApi';
import { BASE_USDC_ADDRESS, BASE_CONFIG } from '@/config/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, sessionKey, bankAccountToken, amount, speed = 'standard' } = body;

    if (!wallet) {
      return createErrorResponse('Wallet address is required');
    }

    if (!sessionKey) {
      return createErrorResponse('Session key is required');
    }

    if (!bankAccountToken) {
      return createErrorResponse('Bank account token is required');
    }

    if (!amount) {
      return createErrorResponse('Amount is required');
    }

    console.log('Requesting withdrawal transaction from Coinflow:', {
      wallet,
      amount,
      bankAccountToken,
      speed,
      merchantId: COINFLOW_MERCHANT_ID(),
      usdcAddress: BASE_USDC_ADDRESS
    });

    // Get withdrawal transaction details from Coinflow
    const response = await fetch(`${COINFLOW_URL()}/withdraw/transaction`, {
      method: 'POST',
      headers: {
        ...getCoinflowHeaders(sessionKey, wallet),
        'x-coinflow-auth-blockchain': 'base'
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        merchantId: COINFLOW_MERCHANT_ID(),
        speed,
        account: bankAccountToken,
        token: {
          mint: BASE_USDC_ADDRESS,
          decimals: BASE_CONFIG.USDC_DECIMALS
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Coinflow withdrawal transaction error:', error);
      return createErrorResponse(`Failed to get withdrawal transaction: ${JSON.stringify(error)}`, response.status);
    }

    const data = await response.json();
    console.log('Withdrawal transaction details:', data);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Error getting withdrawal transaction');
  }
}
