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

export const SOLANA_CONFIG = {
  MAINNET_RPC_URL: "https://api.mainnet-beta.solana.com",
  DEVNET_RPC_URL: "https://api.devnet.solana.com",
  // USDC Mint addresses
  MAINNET_USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  DEVNET_USDC_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  USDC_DECIMALS: 6,
  CCTP_DOMAIN: 5, // Solana CCTP domain ID
  // Solana CCTP Program IDs (mainnet)
  MAINNET_CCTP: {
    MESSAGE_TRANSMITTER: "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd",
    TOKEN_MESSENGER_MINTER: "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3"
  },
  // Solana CCTP Program IDs (devnet)
  DEVNET_CCTP: {
    MESSAGE_TRANSMITTER: "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd",
    TOKEN_MESSENGER_MINTER: "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3"
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

export const SOLANA_RPC_URL: string = (process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta')
  ? SOLANA_CONFIG.MAINNET_RPC_URL
  : SOLANA_CONFIG.DEVNET_RPC_URL;

export const SOLANA_USDC_MINT: string = (process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta')
  ? SOLANA_CONFIG.MAINNET_USDC_MINT
  : SOLANA_CONFIG.DEVNET_USDC_MINT;

export const SOLANA_CCTP_CONTRACTS = (process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta')
  ? SOLANA_CONFIG.MAINNET_CCTP
  : SOLANA_CONFIG.DEVNET_CCTP;

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
if (!SOLANA_RPC_URL) {
  throw new Error('SOLANA_RPC_URL is not defined. Check your SOLANA_CONFIG.');
}
if (!SOLANA_USDC_MINT) {
  throw new Error('SOLANA_USDC_MINT is not defined. Check your SOLANA_CONFIG.');
}
