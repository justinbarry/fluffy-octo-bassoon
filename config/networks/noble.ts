import { NobleChainConfig } from '../types';

/**
 * Noble Mainnet Configuration
 */
export const NOBLE_MAINNET: NobleChainConfig = {
  rpcUrl: 'https://noble-rpc.polkachu.com',
  restUrl: 'https://noble-api.polkachu.com',
  chainId: 'noble-1',
  usdcDenom: 'uusdc',
  usdcDecimals: 6,
  cctpDomain: 4, // Noble CCTP domain ID
};

/**
 * Noble Testnet Configuration (Grand)
 */
export const NOBLE_TESTNET: NobleChainConfig = {
  rpcUrl: 'https://noble-testnet-rpc.polkachu.com',
  restUrl: 'https://noble-testnet-api.polkachu.com',
  chainId: 'grand-1',
  usdcDenom: 'uusdc',
  usdcDecimals: 6,
  cctpDomain: 4, // Noble CCTP domain ID
};
