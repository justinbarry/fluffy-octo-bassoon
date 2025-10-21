/**
 * IBC (Inter-Blockchain Communication) Utilities
 * Centralized functions for building IBC transfer messages
 */

import { EncodeObject } from '@cosmjs/proto-signing';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';
import { getIBCTimeoutTimestamp, usdcToMicroUnits } from './conversions';

// ============================================================================
// IBC Transfer Message Builders
// ============================================================================

/**
 * Parameters for building an IBC transfer message
 */
export interface IBCTransferParams {
  /** Source chain address (sender) */
  senderAddress: string;
  /** Destination chain address (receiver) */
  receiverAddress: string;
  /** Amount in USDC (e.g., "10.5") - will be converted to micro-units */
  amount: string;
  /** Token denomination (e.g., "uusdc" for Noble, or IBC denom for Xion) */
  denom: string;
  /** IBC channel ID (e.g., "channel-0") */
  channel: string;
  /** Optional memo for the transfer */
  memo?: string;
}

/**
 * Build an IBC transfer message
 *
 * @param params - IBC transfer parameters
 * @returns EncodeObject ready for signing and broadcasting
 */
export function buildIBCTransferMessage(params: IBCTransferParams): EncodeObject {
  const {
    senderAddress,
    receiverAddress,
    amount,
    denom,
    channel,
    memo = ''
  } = params;

  // Convert amount to micro-units
  const microUnits = usdcToMicroUnits(amount);

  return {
    typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
    value: MsgTransfer.fromPartial({
      sourcePort: 'transfer',
      sourceChannel: channel,
      token: {
        denom,
        amount: microUnits,
      },
      sender: senderAddress,
      receiver: receiverAddress,
      timeoutHeight: undefined,
      timeoutTimestamp: getIBCTimeoutTimestamp(),
      memo,
    }),
  };
}

/**
 * Build an IBC transfer message with custom timeout
 *
 * @param params - IBC transfer parameters
 * @param timeoutMinutes - Custom timeout in minutes
 * @returns EncodeObject ready for signing and broadcasting
 */
export function buildIBCTransferMessageWithTimeout(
  params: IBCTransferParams,
  timeoutMinutes: number
): EncodeObject {
  const {
    senderAddress,
    receiverAddress,
    amount,
    denom,
    channel,
    memo = ''
  } = params;

  // Convert amount to micro-units
  const microUnits = usdcToMicroUnits(amount);

  // Calculate custom timeout
  const timeoutTimestamp = BigInt(Date.now() + timeoutMinutes * 60 * 1000) * BigInt(1_000_000);

  return {
    typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
    value: MsgTransfer.fromPartial({
      sourcePort: 'transfer',
      sourceChannel: channel,
      token: {
        denom,
        amount: microUnits,
      },
      sender: senderAddress,
      receiver: receiverAddress,
      timeoutHeight: undefined,
      timeoutTimestamp,
      memo,
    }),
  };
}

/**
 * Build an IBC transfer message with micro-units amount directly
 * Use this when you already have the amount in micro-units
 *
 * @param params - IBC transfer parameters with microUnits instead of amount
 * @returns EncodeObject ready for signing and broadcasting
 */
export interface IBCTransferMicroUnitsParams {
  senderAddress: string;
  receiverAddress: string;
  /** Amount in micro-units (e.g., "10000000" for 10 USDC) */
  microUnits: string;
  denom: string;
  channel: string;
  memo?: string;
}

export function buildIBCTransferMessageMicroUnits(
  params: IBCTransferMicroUnitsParams
): EncodeObject {
  const {
    senderAddress,
    receiverAddress,
    microUnits,
    denom,
    channel,
    memo = ''
  } = params;

  return {
    typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
    value: MsgTransfer.fromPartial({
      sourcePort: 'transfer',
      sourceChannel: channel,
      token: {
        denom,
        amount: microUnits,
      },
      sender: senderAddress,
      receiver: receiverAddress,
      timeoutHeight: undefined,
      timeoutTimestamp: getIBCTimeoutTimestamp(),
      memo,
    }),
  };
}
