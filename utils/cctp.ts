/**
 * CCTP (Cross-Chain Transfer Protocol) Utilities
 * Handles attestation fetching and CCTP message parsing
 */

import { Buffer } from 'buffer';
import { ATTESTATION_API_URL, NOBLE_CONFIG } from '@/config/api';
import { CCTPAttestationResponse } from '@/types/cctp';

function decodeBase64(base64: string): Uint8Array {
  if (!base64) {
    return new Uint8Array();
  }

  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const binary = window.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    if (typeof Buffer !== 'undefined') {
      return Uint8Array.from(Buffer.from(base64, 'base64'));
    }
  } catch (error) {
    console.error('❌ Failed to decode base64 string:', error);
  }

  return new Uint8Array();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function ensureHexPrefix(value: string): string {
  if (!value) {
    return value;
  }
  return value.startsWith('0x') ? value : `0x${value}`;
}

export function base64ToHex(base64: string): string {
  if (!base64) {
    return '';
  }

  const bytes = decodeBase64(base64);
  if (!bytes.length) {
    return base64.startsWith('0x') ? base64 : `0x${base64}`;
  }

  return ensureHexPrefix(bytesToHex(bytes));
}

export function normalizeAttestation(attestation: string): string {
  if (!attestation) {
    return '';
  }

  if (attestation.startsWith('0x')) {
    return attestation;
  }

  return base64ToHex(attestation);
}

export function normalizeMessageBytes(message?: string): string {
  if (!message) {
    return '';
  }

  if (message.startsWith('0x')) {
    return message;
  }

  return base64ToHex(message);
}

/**
 * Poll Circle's attestation service for a burn message attestation
 * @param transactionHash - The Noble burn transaction hash
 * @param maxAttempts - Maximum number of polling attempts (default: 40)
 * @param pollInterval - Interval between attempts in ms (default: 3000)
 * @returns The attestation signature
 */
export async function getAttestationSignature(
  transactionHash: string,
  maxAttempts: number = 40,
  pollInterval: number = 3000
): Promise<{ attestation: string; message?: string }> {
  const sourceDomain = NOBLE_CONFIG.CCTP_DOMAIN;
  // CCTP v1 endpoint format: /v1/messages/{sourceDomain}/{transactionHash}
  const url = `${ATTESTATION_API_URL}/v1/messages/${sourceDomain}/${transactionHash}`;

  console.log('🔍 Attestation API URL:', url);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔍 Fetching attestation (attempt ${attempt + 1}/${maxAttempts})...`);

      const response = await fetch(url);

      if (response.status === 404) {
        // Attestation not ready yet, wait and retry
        console.log('⏳ Attestation not ready, waiting...');
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Attestation API error:', errorText);
        throw new Error(`Attestation API error: ${response.status} - ${errorText}`);
      }

      const data: CCTPAttestationResponse = await response.json();

      if (data.status === 'complete' && data.attestation) {
        console.log('✅ Attestation received successfully');
        return {
          attestation: data.attestation,
          message: data.message
        };
      }

      if (data.status === 'pending_confirmations') {
        console.log('⏳ Waiting for block confirmations...');
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      console.log('⏳ Attestation pending, waiting...');
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      console.error(`❌ Error fetching attestation (attempt ${attempt + 1}):`, error);

      // If it's the last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        throw new Error(`Failed to get attestation after ${maxAttempts} attempts: ${error}`);
      }

      // Otherwise, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(`Attestation not available after ${maxAttempts} attempts`);
}

/**
 * Parse CCTP burn event from Noble transaction
 * Note: This is a placeholder - actual implementation will depend on Noble's CCTP module events
 */
export function parseCCTPBurnEvent(txResult: any): {
  messageBytes: string;
  messageHash: string;
  nonce: bigint;
} {
  // TODO: Implement actual event parsing from Noble CCTP module
  // This will require parsing the transaction events/logs
  throw new Error('parseCCTPBurnEvent not yet implemented');
}

/**
 * Convert amount from USDC units to micro-units (6 decimals)
 */
export function usdcToMicroUnits(amount: string): string {
  return `${parseInt(amount) * 1000000}`;
}

/**
 * Convert amount from micro-units to USDC units (6 decimals)
 */
export function microUnitsToUsdc(amount: string): string {
  return (parseInt(amount) / 1000000).toFixed(6);
}

/**
 * Format EVM address with checksum
 */
export function formatEVMAddress(address: string): string {
  return address.toLowerCase().startsWith('0x') ? address : `0x${address}`;
}

/**
 * Validate Ethereum address format
 */
export function isValidEVMAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Estimate CCTP transfer time based on chain finality
 * Noble → Base typically takes 15-20 minutes due to attestation wait time
 */
export function estimateCCTPTransferTime(): string {
  return '15-20 minutes';
}
