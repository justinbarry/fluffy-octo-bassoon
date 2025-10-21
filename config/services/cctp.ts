import { CctpConfig } from '../types';

/**
 * Circle CCTP Mainnet Configuration
 */
export const CCTP_MAINNET: CctpConfig = {
  attestationApiUrl: 'https://iris-api.circle.com',
};

/**
 * Circle CCTP Testnet Configuration
 */
export const CCTP_TESTNET: CctpConfig = {
  attestationApiUrl: 'https://iris-api-sandbox.circle.com',
};
