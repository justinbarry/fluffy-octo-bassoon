/**
 * CCTP Noble Integration
 * Handles burning USDC on Noble via the CCTP module
 */

import { EncodeObject } from '@cosmjs/proto-signing';
import { SigningStargateClient } from '@cosmjs/stargate';
import { Buffer } from 'buffer';
import { NOBLE_CONFIG } from '@/config/api';
import { CCTPBurnResult } from '@/types/cctp';
import { MsgDepositForBurn } from '@/proto/circle/cctp/v1/tx';

/**
 * Burn USDC on Noble using CCTP to transfer to Base
 *
 * Noble implements CCTP as a Cosmos SDK module (not smart contracts like EVM chains).
 * The module uses the message type: /circle.cctp.v1.MsgDepositForBurn
 *
 * @param signingClient - Noble signing client
 * @param senderAddress - Noble sender address (noble1...)
 * @param amount - Amount in micro-units (1 USDC = 1,000,000 uusdc)
 * @param destinationDomain - CCTP domain ID for destination (Base = 6)
 * @param mintRecipient - EVM address on Base to receive USDC (0x...)
 * @returns Burn transaction result with message details
 */
export async function burnUSDCOnNoble(
  signingClient: SigningStargateClient,
  senderAddress: string,
  amount: string,
  destinationDomain: number,
  mintRecipient: string
): Promise<CCTPBurnResult> {
  console.log('🔥 Initiating CCTP burn on Noble:', {
    sender: senderAddress,
    amount: `${amount} uusdc`,
    amountType: typeof amount,
    amountLength: amount.length,
    destinationDomain,
    destinationDomainType: typeof destinationDomain,
    mintRecipient,
    mintRecipientLength: mintRecipient.length
  });

  // Parse mintRecipient and validate
  const mintRecipientBytes = Buffer.from(mintRecipient.replace('0x', ''), 'hex');
  console.log('🔍 Mint recipient bytes:', {
    hex: mintRecipient,
    bytesLength: mintRecipientBytes.length,
    bytes: Array.from(mintRecipientBytes.slice(0, 8)) // First 8 bytes for debugging
  });

  // Noble CCTP module message type
  // Reference: https://github.com/circlefin/noble-cctp
  // Note: Using MsgDepositForBurn (not MsgDepositForBurnWithCaller)
  // This message type allows ANY relayer to call receiveMessage on destination
  // which enables permissionless relaying from the user's frontend
  const burnMsg: EncodeObject = {
    typeUrl: MsgDepositForBurn.typeUrl,
    value: MsgDepositForBurn.fromPartial({
      from: senderAddress,
      amount: amount,
      destinationDomain: destinationDomain,
      mintRecipient: mintRecipientBytes,
      burnToken: NOBLE_CONFIG.USDC_DENOM,
      // No destinationCaller field = allows ANY address to relay (permissionless)
    }),
  };

  console.log('📝 Burn message value:', {
    from: senderAddress,
    amount: amount,
    destinationDomain: destinationDomain,
    mintRecipientLength: mintRecipientBytes.length,
    burnToken: NOBLE_CONFIG.USDC_DENOM
  });

  try {
    // Set gas fee for Noble transaction
    const fee = {
      amount: [{ denom: 'uusdc', amount: '25000' }], // 0.025 USDC gas fee
      gas: '200000'
    };

    const result = await signingClient.signAndBroadcast(
      senderAddress,
      [burnMsg],
      fee,
      'CCTP: Burn USDC on Noble for Base transfer'
    );

    if (result.code !== 0) {
      throw new Error(`CCTP burn failed: ${result.rawLog}`);
    }

    console.log('✅ CCTP burn successful on Noble:', result.transactionHash);

    // Parse burn event to extract message details
    // Note: The actual implementation will need to parse the transaction events
    // to extract the message bytes, message hash, and nonce
    const messageBytes = extractMessageBytesFromEvents(result.events);
    const messageHash = extractMessageHashFromEvents(result.events);
    const nonce = extractNonceFromEvents(result.events);

    return {
      transactionHash: result.transactionHash,
      messageBytes,
      messageHash,
      nonce
    };
  } catch (error) {
    console.error('❌ CCTP burn failed on Noble:', error);
    throw error;
  }
}

/**
 * Extract CCTP message bytes from transaction events
 * The Noble CCTP module emits events with the message details
 */
function extractMessageBytesFromEvents(events: readonly any[]): string {
  // TODO: Implement actual event parsing
  // Noble CCTP module emits events like:
  // - circle.cctp.v1.MessageSent
  // - circle.cctp.v1.DepositForBurn
  //
  // These events contain the message bytes needed for attestation

  for (const event of events) {
    if (event.type === 'circle.cctp.v1.MessageSent' || event.type === 'message_sent') {
      for (const attr of event.attributes || []) {
        if (attr.key === 'message' || attr.key === 'message_bytes') {
          return attr.value;
        }
      }
    }
  }

  // If not found in events, return empty string (will need attestation service)
  console.warn('⚠️ Could not extract message bytes from events');
  return '';
}

/**
 * Extract CCTP message hash from transaction events
 */
function extractMessageHashFromEvents(events: readonly any[]): string {
  for (const event of events) {
    if (event.type === 'circle.cctp.v1.MessageSent' || event.type === 'message_sent') {
      for (const attr of event.attributes || []) {
        if (attr.key === 'message_hash') {
          return attr.value;
        }
      }
    }
  }

  console.warn('⚠️ Could not extract message hash from events');
  return '';
}

/**
 * Extract nonce from transaction events
 */
function extractNonceFromEvents(events: readonly any[]): bigint {
  for (const event of events) {
    if (event.type === 'circle.cctp.v1.MessageSent' || event.type === 'message_sent') {
      for (const attr of event.attributes || []) {
        if (attr.key === 'nonce') {
          return BigInt(attr.value);
        }
      }
    }
  }

  console.warn('⚠️ Could not extract nonce from events');
  return BigInt(0);
}

/**
 * Format amount from USDC to micro-units
 */
export function formatUSDCAmount(usdcAmount: string): string {
  return `${parseInt(usdcAmount) * 1000000}`;
}
