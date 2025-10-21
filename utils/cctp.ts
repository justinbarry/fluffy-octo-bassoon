/**
 * CCTP (Cross-Chain Transfer Protocol) Utilities
 * Handles attestation fetching and CCTP message parsing
 */

import { bridge, cctp } from '@/config';
import { CCTPAttestationResponse } from '@/types/cctp';
import { ATTESTATION_MAX_ATTEMPTS, ATTESTATION_POLL_INTERVAL } from './constants';

// Re-export conversion functions from conversions.ts
export {
  normalizeAttestation,
  normalizeMessageBytes,
  base64ToHex,
  usdcToMicroUnits,
  microUnitsToUsdc,
  formatEVMAddress,
  isValidEVMAddress
} from './conversions';

/**
 * Poll Circle's attestation service for a burn message attestation
 * @param transactionHash - The Noble burn transaction hash
 * @param maxAttempts - Maximum number of polling attempts (default: from constants)
 * @param pollInterval - Interval between attempts in ms (default: from constants)
 * @returns The attestation signature
 */
export async function getAttestationSignature(
  transactionHash: string,
  maxAttempts: number = ATTESTATION_MAX_ATTEMPTS,
  pollInterval: number = ATTESTATION_POLL_INTERVAL
): Promise<{ attestation: string; message?: string }> {
  const sourceDomain = bridge.cctpDomain;
  // CCTP v1 endpoint format: /v1/messages/{sourceDomain}/{transactionHash}
  const url = `${cctp.attestationApiUrl}/v1/messages/${sourceDomain}/${transactionHash}`;

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
 * Estimate CCTP transfer time based on chain finality
 * Noble → Base typically takes 15-20 minutes due to attestation wait time
 */
export function estimateCCTPTransferTime(): string {
  return '15-20 minutes';
}
