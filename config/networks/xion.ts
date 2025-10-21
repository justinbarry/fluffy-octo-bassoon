import { XionChainConfig } from '../types';

/**
 * Xion Mainnet Configuration
 */
export const XION_MAINNET: XionChainConfig = {
  rpcUrl: 'https://rpc.xion-mainnet-1.burnt.com/',
  restUrl: 'https://api.xion-mainnet-1.burnt.com/',
  chainId: 'xion-mainnet-1',
  treasury: 'xion1aajlc8pcex69hk48lqtq9n53qh5525q2chp77vuf75uxmqsw2rnqsq4tsc',
  usdcDenom: 'ibc/F082B65C88E4B6D5EF1DB243CDA1D331D002759E938A0F5CD3FFDC5D53B3E349',
  usdcDecimals: 6,
  ibcChannel: 'channel-2', // Xion → Noble mainnet
};

/**
 * Xion Testnet Configuration
 */
export const XION_TESTNET: XionChainConfig = {
  rpcUrl: 'https://rpc.xion-testnet-2.burnt.com/',
  restUrl: 'https://api.xion-testnet-2.burnt.com/',
  chainId: 'xion-testnet-2',
  treasury: 'xion1xeuhnnwgad2hfql0k39w999s4wqc0qt0xmhhjwgmzs7rs3j9e7jswhw23f',
  usdcDenom: 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4',
  usdcDecimals: 6,
  ibcChannel: 'channel-3', // Xion → Noble testnet
};
