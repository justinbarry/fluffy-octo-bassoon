/**
 * Constants
 * Centralized configuration values for gas fees, timeouts, and other constants
 */

// ============================================================================
// Gas Fees (in micro-units, 1 USDC = 1,000,000 micro-units)
// ============================================================================

/**
 * Gas fee buffer for Noble CCTP burn operations
 * Approximately 0.04 USDC
 */
export const NOBLE_BURN_GAS_BUFFER = 40000;

/**
 * Gas fee for Noble IBC transfers
 * Approximately 0.025 USDC
 */
export const NOBLE_IBC_GAS_FEE = 25000;

/**
 * Gas limit for Noble transactions
 */
export const NOBLE_GAS_LIMIT = '200000';

// ============================================================================
// Attestation Polling Configuration
// ============================================================================

/**
 * Maximum number of attempts to fetch Circle attestation
 * Default: 240 attempts
 */
export const ATTESTATION_MAX_ATTEMPTS = 240;

/**
 * Interval between attestation polling attempts in milliseconds
 * Default: 5000ms (5 seconds)
 */
export const ATTESTATION_POLL_INTERVAL = 5000;

/**
 * Alternative polling configuration for faster attempts
 */
export const ATTESTATION_QUICK_POLL_INTERVAL = 3000;
export const ATTESTATION_QUICK_MAX_ATTEMPTS = 40;

// ============================================================================
// IBC Transfer Configuration
// ============================================================================

/**
 * IBC settlement wait time in milliseconds
 * Typical IBC transfers settle in ~8 seconds
 */
export const IBC_SETTLEMENT_WAIT_TIME = 8000;

/**
 * IBC transfer timeout duration in minutes
 * Default: 10 minutes
 */
export const IBC_TIMEOUT_MINUTES = 10;

/**
 * Calculate IBC timeout timestamp (current time + timeout duration)
 * Returns timestamp in nanoseconds as required by IBC protocol
 */
export function getIBCTimeoutTimestamp(): bigint {
  return BigInt(Date.now() + IBC_TIMEOUT_MINUTES * 60 * 1000) * BigInt(1_000_000);
}

// ============================================================================
// Balance Polling Configuration
// ============================================================================

/**
 * Interval for polling blockchain balances in milliseconds
 * Default: 10 seconds
 */
export const BALANCE_POLL_INTERVAL = 10000;

// ============================================================================
// Network Configuration
// ============================================================================

/**
 * Get the current network environment (mainnet or testnet/sepolia)
 */
export function getNetworkEnvironment(): 'mainnet' | 'sepolia' {
  return process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
}

/**
 * Get the Coinflow environment (mainnet or sandbox/testnet)
 */
export function getCoinflowEnvironment(): 'mainnet' | 'sandbox' {
  const env = process.env.COINFLOW_ENV || process.env.NEXT_PUBLIC_COINFLOW_ENV || 'testnet';
  return env === 'mainnet' ? 'mainnet' : 'sandbox';
}

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Time to display success messages before auto-clearing (milliseconds)
 */
export const SUCCESS_MESSAGE_DURATION = 5000;

/**
 * USDC Token decimals
 */
export const USDC_DECIMALS = 6;
