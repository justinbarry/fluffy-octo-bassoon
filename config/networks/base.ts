import { EvmChainConfig } from '../types';

/**
 * Base Mainnet Configuration
 */
export const BASE_MAINNET: EvmChainConfig = {
  rpcUrl: 'https://mainnet.base.org',
  chainId: 8453,
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  usdcDecimals: 6,
  cctpDomain: 6, // Base CCTP domain ID
  cctp: {
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    tokenMinter: '0xfd78EE919681417d192449715b2594ab58f5D002',
  },
};

/**
 * Base Sepolia Testnet Configuration
 */
export const BASE_TESTNET: EvmChainConfig = {
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532,
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  usdcDecimals: 6,
  cctpDomain: 6, // Base CCTP domain ID
  cctp: {
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
  },
};
