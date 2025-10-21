import { NextRequest } from 'next/server';
import {
  validateFields,
  validateWallet,
  validateSessionKey,
  validateSignature,
  validateMessage,
  getCoinflowBaseHeaders,
  buildWithdrawalRequestBody,
  makeCoinflowRequest,
  handleApiError
} from '@/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, sessionKey, signature, message, amount, speed, bankAccountToken } = body;

    // Validate required fields
    const validation = validateFields([
      validateWallet(wallet),
      validateSessionKey(sessionKey),
      validateSignature(signature),
      validateMessage(message)
    ]);

    if (!validation.isValid) {
      return validation.error;
    }

    console.log('Submitting gasless EVM transaction to Coinflow:', {
      wallet,
      hasSignature: !!signature,
      hasMessage: !!message,
      amount,
      speed,
      bankAccountToken
    });

    // Submit the signed permit message to Coinflow for gasless withdrawal
    return await makeCoinflowRequest({
      endpoint: '/withdraw/evm/transaction',
      method: 'POST',
      headers: getCoinflowBaseHeaders(sessionKey, wallet),
      body: buildWithdrawalRequestBody({
        amount,
        speed,
        bankAccountToken,
        evmAuthData: {
          data: signature // The signature from signedTypedData
        }
      })
    });
  } catch (error) {
    return handleApiError(error, 'Error submitting gasless transaction');
  }
}
