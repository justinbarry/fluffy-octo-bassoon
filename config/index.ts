/**
 * Main configuration module
 *
 * This module provides a clean interface for accessing network and service configurations.
 * All configurations are environment-aware (mainnet vs testnet) based on NEXT_PUBLIC_COINFLOW_ENV.
 *
 * Architecture:
 * - sources: Source chains where users can start their bridge journey
 * - bridge: Intermediate chain used for CCTP bridging (Noble)
 * - destinations: Destination chains where users can receive funds
 * - coinflow: Coinflow payment service configuration
 * - cctp: Circle CCTP service configuration
 */

import { XION_MAINNET, XION_TESTNET } from './networks/xion';
import { NOBLE_MAINNET, NOBLE_TESTNET } from './networks/noble';
import { BASE_MAINNET, BASE_TESTNET } from './networks/base';
import { COINFLOW_MAINNET, COINFLOW_SANDBOX } from './services/coinflow';
import { CCTP_MAINNET, CCTP_TESTNET } from './services/cctp';

/**
 * Determine the current environment from env var
 * Defaults to 'testnet' if not set or set to any value other than 'mainnet'
 */
const ENV = process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet' ? 'mainnet' : 'testnet';

/**
 * Source chains - where users can initiate bridges from
 * Future: Can add more Cosmos chains (Osmosis, CosmosHub, etc.)
 */
export const sources = {
  xion: ENV === 'mainnet' ? XION_MAINNET : XION_TESTNET,
};

/**
 * Bridge chain - Noble is used as the intermediate chain for CCTP
 */
export const bridge = ENV === 'mainnet' ? NOBLE_MAINNET : NOBLE_TESTNET;

/**
 * Destination chains - where users can bridge to
 * Future: Easy to add Polygon, Arbitrum, Optimism, etc.
 */
export const destinations = {
  base: ENV === 'mainnet' ? BASE_MAINNET : BASE_TESTNET,
};

/**
 * Coinflow payment service configuration
 */
export const coinflow = ENV === 'mainnet' ? COINFLOW_MAINNET : COINFLOW_SANDBOX;

/**
 * Circle CCTP service configuration
 */
export const cctp = ENV === 'mainnet' ? CCTP_MAINNET : CCTP_TESTNET;

/**
 * Re-export types for convenience
 */
export type {
  NetworkEnvironment,
  CosmosChainConfig,
  XionChainConfig,
  NobleChainConfig,
  EvmChainConfig,
  CoinflowConfig,
  CctpConfig,
} from './types';

/**
 * Environment validation
 */
if (!sources.xion) {
  throw new Error('Xion configuration is not defined. Check your environment setup.');
}

if (!bridge) {
  throw new Error('Noble (bridge) configuration is not defined. Check your environment setup.');
}

if (!destinations.base) {
  throw new Error('Base configuration is not defined. Check your environment setup.');
}

if (!coinflow) {
  throw new Error('Coinflow configuration is not defined. Check your environment setup.');
}

if (!cctp) {
  throw new Error('CCTP configuration is not defined. Check your environment setup.');
}

/**
 * Helper to get the current environment
 */
export const getCurrentEnvironment = () => ENV;
