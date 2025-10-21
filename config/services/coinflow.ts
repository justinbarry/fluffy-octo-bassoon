import { CoinflowConfig } from '../types';

/**
 * Coinflow Mainnet Configuration
 */
export const COINFLOW_MAINNET: CoinflowConfig = {
  apiUrl: 'https://api.coinflow.cash/api',
  baseUrl: 'https://coinflow.cash',
  merchantId: 'XionFoundation',
};

/**
 * Coinflow Sandbox Configuration (for testnet)
 */
export const COINFLOW_SANDBOX: CoinflowConfig = {
  apiUrl: 'https://api-sandbox.coinflow.cash/api',
  baseUrl: 'https://sandbox.coinflow.cash',
  merchantId: 'burntlabs',
};
