import { NextRequest } from 'next/server';
import {
  validateFields,
  validateWallet,
  validateSessionKey,
  getCoinflowBaseHeaders,
  makeCoinflowRequest,
  handleApiError
} from '@/utils/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const sessionKey = searchParams.get('sessionKey');

    // Validate required fields
    const validation = validateFields([
      validateWallet(wallet),
      validateSessionKey(sessionKey)
    ]);

    if (!validation.isValid) {
      return validation.error;
    }

    console.log('Fetching withdrawer details for:', wallet);

    // Get the withdrawer details from Coinflow
    return await makeCoinflowRequest({
      endpoint: '/withdraw',
      method: 'GET',
      headers: getCoinflowBaseHeaders(sessionKey!, wallet!)
    });
  } catch (error) {
    return handleApiError(error, 'Error getting withdrawer details');
  }
}
