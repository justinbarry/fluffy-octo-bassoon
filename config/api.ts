export const COINFLOW_API = {
  SANDBOX_URL: 'https://api-sandbox.coinflow.cash/api',
  MAINNET_URL: 'https://api.coinflow.cash/api',
  SANDBOX_BASE_URL: 'https://sandbox.coinflow.cash',
  MAINNET_BASE_URL: 'https://coinflow.cash',
  USDC_MINT: process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
    ? 'ibc/F082B65C88E4B6D5EF1DB243CDA1D331D002759E938A0F5CD3FFDC5D53B3E349' // mainnet USDC on Xion
    : 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4', // testnet USDC on Xion
  USDC_DECIMALS: 6,
  MERCHANT_ID: 'burntlabs',
  MAINNET_MERCHANT_ID: 'XionFoundation',
} as const;

export const XION_CONFIG = {
  MAINNET_TREASURY: "xion1aajlc8pcex69hk48lqtq9n53qh5525q2chp77vuf75uxmqsw2rnqsq4tsc",
  TESTNET_TREASURY: "xion1xeuhnnwgad2hfql0k39w999s4wqc0qt0xmhhjwgmzs7rs3j9e7jswhw23f",
  MAINNET_RPC_URL: "https://rpc.xion-mainnet-1.burnt.com/",
  TESTNET_RPC_URL: "https://rpc.xion-testnet-2.burnt.com/",
  MAINNET_REST_URL: "https://api.xion-mainnet-1.burnt.com/",
  TESTNET_REST_URL: "https://api.xion-testnet-2.burnt.com/"
} as const;

export const NOBLE_CONFIG = {
  MAINNET_RPC_URL: "https://noble-rpc.polkachu.com",
  TESTNET_RPC_URL: "https://noble-testnet-rpc.polkachu.com",
  MAINNET_REST_URL: "https://noble-api.polkachu.com",
  TESTNET_REST_URL: "https://noble-testnet-api.polkachu.com",
  MAINNET_CHAIN_ID: "noble-1",
  TESTNET_CHAIN_ID: "grand-1",
  USDC_DENOM: "uusdc", // Native USDC on Noble
  USDC_DECIMALS: 6,
  CCTP_DOMAIN: 4 // Noble CCTP domain ID
} as const;

export const BASE_CONFIG = {
  MAINNET_RPC_URL: "https://mainnet.base.org",
  SEPOLIA_RPC_URL: "https://sepolia.base.org",
  // USDC Token addresses
  MAINNET_USDC_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  SEPOLIA_USDC_ADDRESS: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  USDC_DECIMALS: 6,
  CCTP_DOMAIN: 6, // Base CCTP domain ID
  // Base Chain IDs
  MAINNET_CHAIN_ID: 8453,
  SEPOLIA_CHAIN_ID: 84532,
  // Base CCTP Contract Addresses (mainnet)
  MAINNET_CCTP: {
    TOKEN_MESSENGER: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
    MESSAGE_TRANSMITTER: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
    TOKEN_MINTER: "0xfd78EE919681417d192449715b2594ab58f5D002"
  },
  // Base CCTP Contract Addresses (Sepolia testnet)
  SEPOLIA_CCTP: {
    TOKEN_MESSENGER: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    MESSAGE_TRANSMITTER: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    TOKEN_MINTER: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192"
  }
} as const;

export const CCTP_CONFIG = {
  // Circle's Iris Attestation API
  MAINNET_ATTESTATION_API: "https://iris-api.circle.com",
  TESTNET_ATTESTATION_API: "https://iris-api-sandbox.circle.com"
} as const;

// Environment-based exports
export const XION_TREASURY: string = (process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet')
  ? XION_CONFIG.MAINNET_TREASURY
  : XION_CONFIG.TESTNET_TREASURY;

export const XION_RPC_URL: string = (process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet')
  ? XION_CONFIG.MAINNET_RPC_URL
  : XION_CONFIG.TESTNET_RPC_URL;

export const XION_REST_URL: string = (process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet')
  ? XION_CONFIG.MAINNET_REST_URL
  : XION_CONFIG.TESTNET_REST_URL;

export const NOBLE_RPC_URL: string = (process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet')
  ? NOBLE_CONFIG.MAINNET_RPC_URL
  : NOBLE_CONFIG.TESTNET_RPC_URL;

export const NOBLE_REST_URL: string = (process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet')
  ? NOBLE_CONFIG.MAINNET_REST_URL
  : NOBLE_CONFIG.TESTNET_REST_URL;

export const BASE_RPC_URL: string = (process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet')
  ? BASE_CONFIG.MAINNET_RPC_URL
  : BASE_CONFIG.SEPOLIA_RPC_URL;

export const BASE_USDC_ADDRESS: string = (process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet')
  ? BASE_CONFIG.MAINNET_USDC_ADDRESS
  : BASE_CONFIG.SEPOLIA_USDC_ADDRESS;

export const BASE_CHAIN_ID: number = (process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet')
  ? BASE_CONFIG.MAINNET_CHAIN_ID
  : BASE_CONFIG.SEPOLIA_CHAIN_ID;

export const BASE_CCTP_CONTRACTS = (process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet')
  ? BASE_CONFIG.MAINNET_CCTP
  : BASE_CONFIG.SEPOLIA_CCTP;

export const ATTESTATION_API_URL: string = (process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet')
  ? CCTP_CONFIG.MAINNET_ATTESTATION_API
  : CCTP_CONFIG.TESTNET_ATTESTATION_API;

export const COINFLOW_MERCHANT_ID =
  process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
    ? COINFLOW_API.MAINNET_MERCHANT_ID
    : COINFLOW_API.MERCHANT_ID;

export const COINFLOW_BASE_URL =
  process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
    ? COINFLOW_API.MAINNET_BASE_URL
    : COINFLOW_API.SANDBOX_BASE_URL;

export const COINFLOW_URL =
  process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
    ? COINFLOW_API.MAINNET_URL
    : COINFLOW_API.SANDBOX_URL;

// Validation
if (!XION_TREASURY) {
  throw new Error('XION_TREASURY is not defined. Check your XION_CONFIG and COINFLOW_ENV.');
}
if (!XION_RPC_URL) {
  throw new Error('XION_RPC_URL is not defined. Check your XION_CONFIG and COINFLOW_ENV.');
}
if (!NOBLE_RPC_URL) {
  throw new Error('NOBLE_RPC_URL is not defined. Check your NOBLE_CONFIG and COINFLOW_ENV.');
}
if (!BASE_RPC_URL) {
  throw new Error('BASE_RPC_URL is not defined. Check your BASE_CONFIG.');
}
if (!BASE_USDC_ADDRESS) {
  throw new Error('BASE_USDC_ADDRESS is not defined. Check your BASE_CONFIG.');
}
