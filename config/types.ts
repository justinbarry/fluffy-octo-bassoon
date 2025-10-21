/**
 * Network environment types
 */
export type NetworkEnvironment = 'mainnet' | 'testnet';

/**
 * Cosmos-based chain configuration
 */
export interface CosmosChainConfig {
  rpcUrl: string;
  restUrl: string;
  chainId: string;
  usdcDenom: string;
  usdcDecimals: number;
}

/**
 * Xion-specific configuration (extends Cosmos config)
 */
export interface XionChainConfig extends CosmosChainConfig {
  treasury: string;
  ibcChannel: string; // IBC channel to Noble
}

/**
 * Noble-specific configuration (extends Cosmos config)
 */
export interface NobleChainConfig extends CosmosChainConfig {
  cctpDomain: number;
}

/**
 * EVM-based chain configuration
 */
export interface EvmChainConfig {
  rpcUrl: string;
  chainId: number;
  usdcAddress: string;
  usdcDecimals: number;
  cctpDomain: number;
  cctp: {
    tokenMessenger: string;
    messageTransmitter: string;
    tokenMinter: string;
  };
}

/**
 * Coinflow service configuration
 */
export interface CoinflowConfig {
  apiUrl: string;
  baseUrl: string;
  merchantId: string;
}

/**
 * CCTP service configuration
 */
export interface CctpConfig {
  attestationApiUrl: string;
}
