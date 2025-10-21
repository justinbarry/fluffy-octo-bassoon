/**
 * API Helper Utilities
 * Centralized validation and request building for Coinflow API routes
 */

import { NextResponse } from 'next/server';
import { destinations } from '@/config';
import { getCoinflowHeaders, COINFLOW_URL, COINFLOW_MERCHANT_ID } from './coinflowApi';
import { USDC_DECIMALS } from './constants';

// ============================================================================
// Error Handling (Re-export from coinflowApi for convenience)
// ============================================================================

export { createErrorResponse, handleApiError } from './coinflowApi';

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Validation result for request parameters
 */
export interface ValidationResult {
  isValid: boolean;
  error?: NextResponse;
}

/**
 * Validate that wallet address is provided
 */
export function validateWallet(wallet?: string | null): ValidationResult {
  if (!wallet) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    };
  }
  return { isValid: true };
}

/**
 * Validate that session key is provided
 */
export function validateSessionKey(sessionKey?: string | null): ValidationResult {
  if (!sessionKey) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Session key is required' }, { status: 400 })
    };
  }
  return { isValid: true };
}

/**
 * Validate that amount is provided and valid
 */
export function validateAmount(amount?: string | number | null): ValidationResult {
  if (!amount) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    };
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || numAmount <= 0) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    };
  }

  return { isValid: true };
}

/**
 * Validate bank account token
 */
export function validateBankAccountToken(token?: string | null): ValidationResult {
  if (!token) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Bank account token is required' }, { status: 400 })
    };
  }
  return { isValid: true };
}

/**
 * Validate transaction hash
 */
export function validateHash(hash?: string | null): ValidationResult {
  if (!hash) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    };
  }
  return { isValid: true };
}

/**
 * Validate signature
 */
export function validateSignature(signature?: string | null): ValidationResult {
  if (!signature) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Signature is required' }, { status: 400 })
    };
  }
  return { isValid: true };
}

/**
 * Validate message
 */
export function validateMessage(message?: any): ValidationResult {
  if (!message) {
    return {
      isValid: false,
      error: NextResponse.json({ error: 'Message is required' }, { status: 400 })
    };
  }
  return { isValid: true };
}

/**
 * Validate multiple fields at once
 * Returns the first validation error encountered, or { isValid: true } if all pass
 */
export function validateFields(validations: ValidationResult[]): ValidationResult {
  for (const validation of validations) {
    if (!validation.isValid) {
      return validation;
    }
  }
  return { isValid: true };
}

// ============================================================================
// Coinflow API Request Builders
// ============================================================================

/**
 * Common Coinflow request headers for Base blockchain
 */
export function getCoinflowBaseHeaders(sessionKey: string, wallet: string): Record<string, string> {
  return {
    ...getCoinflowHeaders(sessionKey, wallet),
    'x-coinflow-auth-blockchain': 'base'
  };
}

/**
 * Token configuration object for Coinflow requests
 */
export interface TokenConfig {
  mint: string;
  decimals: number;
}

/**
 * Get Base USDC token configuration for Coinflow
 */
export function getBaseUSDCTokenConfig(): TokenConfig {
  return {
    mint: destinations.base.usdcAddress,
    decimals: destinations.base.usdcDecimals || USDC_DECIMALS
  };
}

/**
 * Build withdrawal request body for Coinflow
 */
export interface WithdrawalRequestParams {
  amount: string | number;
  speed?: 'standard' | 'fast';
  bankAccountToken: string;
  evmAuthData?: {
    data: string;
  };
}

export function buildWithdrawalRequestBody(params: WithdrawalRequestParams): object {
  const body: any = {
    amount: typeof params.amount === 'string' ? parseFloat(params.amount) : params.amount,
    merchantId: COINFLOW_MERCHANT_ID(),
    speed: params.speed || 'standard',
    account: params.bankAccountToken,
    token: getBaseUSDCTokenConfig()
  };

  if (params.evmAuthData) {
    body.evmTransferAuthorizationData = params.evmAuthData;
  }

  return body;
}

/**
 * Make a Coinflow API request with standardized error handling
 */
export interface CoinflowRequestOptions {
  endpoint: string;
  method?: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: object;
}

export async function makeCoinflowRequest(options: CoinflowRequestOptions): Promise<NextResponse> {
  const { endpoint, method = 'GET', headers, body } = options;
  const url = `${COINFLOW_URL()}${endpoint}`;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (body && method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error = await response.json();
      console.error(`Coinflow API error (${endpoint}):`, error);
      return NextResponse.json(
        { error: `Coinflow API error: ${JSON.stringify(error)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error calling Coinflow API (${endpoint}):`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
