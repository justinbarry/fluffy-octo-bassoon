import { NextRequest } from 'next/server';
import {
  validateFields,
  validateWallet,
  validateSessionKey,
  validateBankAccountToken,
  validateAmount,
  getCoinflowBaseHeaders,
  buildWithdrawalRequestBody,
  makeCoinflowRequest,
  handleApiError
} from '@/utils/apiHelpers';
import { COINFLOW_MERCHANT_ID } from '@/utils/coinflowApi';
import { destinations } from '@/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, sessionKey, bankAccountToken, amount, speed = 'standard' } = body;

    // Validate required fields
    const validation = validateFields([
      validateWallet(wallet),
      validateSessionKey(sessionKey),
      validateBankAccountToken(bankAccountToken),
      validateAmount(amount)
    ]);

    if (!validation.isValid) {
      return validation.error;
    }

    console.log('Getting EVM permit message from Coinflow:', {
      wallet,
      amount,
      bankAccountToken,
      speed,
      merchantId: COINFLOW_MERCHANT_ID(),
      usdcAddress: destinations.base.usdcAddress
    });

    // Get EVM permit message from Coinflow for gasless withdrawal
    return await makeCoinflowRequest({
      endpoint: '/withdraw/evm/message',
      method: 'POST',
      headers: getCoinflowBaseHeaders(sessionKey, wallet),
      body: buildWithdrawalRequestBody({
        amount,
        speed,
        bankAccountToken
      })
    });
  } catch (error) {
    return handleApiError(error, 'Error getting EVM message');
  }
}
