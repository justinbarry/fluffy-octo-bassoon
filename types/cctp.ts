/**
 * CCTP (Cross-Chain Transfer Protocol) Types and Interfaces
 */

export interface CCTPBurnMessage {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  sender: string;
  recipient: string;
  destinationCaller: string;
  messageBody: string;
}

export interface CCTPAttestationResponse {
  status: string;
  attestation: string;
  message?: string;
}

export interface CCTPTransferParams {
  amount: string;
  destinationDomain: number;
  mintRecipient: string;
  burnToken: string;
}

export interface CCTPBurnResult {
  transactionHash: string;
  messageBytes: string;
  messageHash: string;
  nonce: bigint;
}

export interface CCTPMintResult {
  transactionHash: string;
  success: boolean;
}

export type DestinationChain = 'noble' | 'base';

export interface WithdrawalDestination {
  chain: DestinationChain;
  label: string;
  estimatedTime: string;
  gasCost: string;
}

// Base-specific types
export interface BaseCCTPMintParams {
  messageBytes: Buffer;
  attestation: Buffer;
  recipientAddress: string;
}
