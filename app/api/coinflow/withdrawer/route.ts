import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, handleApiError, getCoinflowHeaders, COINFLOW_URL } from '@/utils/coinflowApi';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const sessionKey = searchParams.get('sessionKey');

    if (!wallet) {
      return createErrorResponse('Wallet address is required');
    }

    if (!sessionKey) {
      return createErrorResponse('Session key is required');
    }

    console.log('Fetching withdrawer details for:', wallet);

    // Get the withdrawer details from Coinflow
    const response = await fetch(`${COINFLOW_URL()}/withdraw`, {
      method: 'GET',
      headers: getCoinflowHeaders(sessionKey, wallet)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Coinflow withdrawer error:', error);
      return createErrorResponse('Failed to get withdrawer details', response.status);
    }

    const data = await response.json();
    console.log('Withdrawer details:', data);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'Error getting withdrawer details');
  }
}
