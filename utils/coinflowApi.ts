import { coinflow } from '@/config';
import { NextResponse } from 'next/server';

export const createErrorResponse = (message: string, status: number = 400) => {
  return NextResponse.json({ error: message }, { status });
};

export const handleApiError = (error: unknown, customMessage?: string) => {
  console.error(customMessage || 'API Error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
};

export const COINFLOW_URL = () => {
  return coinflow.apiUrl;
};

export const COINFLOW_MERCHANT_ID = () => {
  return coinflow.merchantId;
};

export const getCoinflowHeaders = (sessionKey?: string | null, walletAddress?: string) => {
  const env = process.env.COINFLOW_ENV || process.env.NEXT_PUBLIC_COINFLOW_ENV || 'testnet';
  const apiKey = env === 'mainnet'
    ? process.env.COINFLOW_API_KEY_MAINNET || ''
    : process.env.COINFLOW_API_KEY_SANDBOX || '';
  const merchantId = COINFLOW_MERCHANT_ID();

  console.log('🔧 Building Coinflow headers:', {
    env,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    merchantId,
    hasSessionKey: !!sessionKey,
    sessionKeyLength: sessionKey?.length,
    hasWalletAddress: !!walletAddress,
    walletAddress: walletAddress ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 8)}` : undefined
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Merchant-Id': merchantId,
    'x-coinflow-api-key': apiKey || '',
  };

  if (sessionKey) {
    headers['x-coinflow-auth-session-key'] = sessionKey;
  }

  if (walletAddress) {
    headers['X-Wallet-Address'] = walletAddress;
  }

  console.log('🔑 Generated Coinflow headers:', {
    headerKeys: Object.keys(headers),
    hasAccept: !!headers['Accept'],
    hasContentType: !!headers['Content-Type'],
    hasMerchantId: !!headers['X-Merchant-Id'],
    hasApiKey: !!headers['x-coinflow-api-key'],
    hasSessionKey: !!headers['x-coinflow-auth-session-key'],
    hasWalletAddress: !!headers['X-Wallet-Address']
  });

  return headers;
};
