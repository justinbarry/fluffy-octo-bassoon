import { NextRequest } from 'next/server';
import {
  validateFields,
  validateWallet,
  validateSessionKey,
  validateHash,
  getCoinflowBaseHeaders,
  makeCoinflowRequest,
  handleApiError
} from '@/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, sessionKey, hash } = body;

    // Validate required fields
    const validation = validateFields([
      validateWallet(wallet),
      validateSessionKey(sessionKey),
      validateHash(hash)
    ]);

    if (!validation.isValid) {
      return validation.error;
    }

    console.log('Submitting transaction hash to Coinflow:', { wallet, hash });

    // Submit transaction hash to Coinflow
    return await makeCoinflowRequest({
      endpoint: '/transaction',
      method: 'POST',
      headers: getCoinflowBaseHeaders(sessionKey, wallet),
      body: {
        hash,
        blockchain: 'base'
      }
    });
  } catch (error) {
    return handleApiError(error, 'Error submitting transaction hash');
  }
}
