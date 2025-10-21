/**
 * Conversion Utilities
 * Centralized functions for amount conversions, hex/base64 formatting, and address handling
 */

import { Buffer } from 'buffer';

// ============================================================================
// Amount Conversions (USDC has 6 decimals)
// ============================================================================

/**
 * Convert USDC amount to micro-units (multiply by 1,000,000)
 * @param amount - Amount in USDC (e.g., "1.5" = 1.5 USDC)
 * @returns Amount in micro-units as string (e.g., "1500000")
 */
export function usdcToMicroUnits(amount: string | number): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.floor(numAmount * 1_000_000).toString();
}

/**
 * Convert micro-units to USDC amount (divide by 1,000,000)
 * @param microUnits - Amount in micro-units (e.g., "1500000")
 * @returns Amount in USDC as string (e.g., "1.50")
 */
export function microUnitsToUsdc(microUnits: string | number): string {
  const numAmount = typeof microUnits === 'string' ? parseInt(microUnits) : microUnits;
  return (numAmount / 1_000_000).toFixed(6);
}

/**
 * Convert micro-units to USDC with custom decimal places
 * @param microUnits - Amount in micro-units
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted USDC amount
 */
export function microUnitsToUsdcFormatted(microUnits: string | number, decimals: number = 2): string {
  const numAmount = typeof microUnits === 'string' ? parseInt(microUnits) : microUnits;
  return (numAmount / 1_000_000).toFixed(decimals);
}

// ============================================================================
// Hex & Base64 Conversions
// ============================================================================

/**
 * Decode base64 string to Uint8Array (works in both browser and Node.js)
 */
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

/**
 * Convert byte array to hex string (without 0x prefix)
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ensure a hex string has the 0x prefix
 */
export function ensureHexPrefix(value: string): string {
  if (!value) {
    return value;
  }
  return value.startsWith('0x') ? value : `0x${value}`;
}

/**
 * Remove 0x prefix from hex string if present
 */
export function removeHexPrefix(value: string): string {
  if (!value) {
    return value;
  }
  return value.startsWith('0x') ? value.slice(2) : value;
}

/**
 * Convert base64 string to hex with 0x prefix
 */
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

/**
 * Normalize attestation to hex format with 0x prefix
 * Handles both base64 and hex inputs
 */
export function normalizeAttestation(attestation: string): string {
  if (!attestation) {
    return '';
  }

  if (attestation.startsWith('0x')) {
    return attestation;
  }

  return base64ToHex(attestation);
}

/**
 * Normalize message bytes to hex format with 0x prefix
 * Handles both base64 and hex inputs
 */
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
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = removeHexPrefix(hex);
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

// ============================================================================
// Address Formatting for CCTP (32-byte format)
// ============================================================================

/**
 * Format EVM address to 32-byte format for CCTP (with left padding)
 * EVM addresses are 20 bytes, CCTP expects 32 bytes
 *
 * @param address - EVM address (with or without 0x prefix)
 * @returns 32-byte address as Uint8Array
 */
export function formatAddressForCCTP(address: string): Uint8Array {
  const cleanAddress = removeHexPrefix(address);

  // EVM addresses are 20 bytes (40 hex chars), CCTP expects 32 bytes
  // Pad with zeros on the left
  const paddedAddress = cleanAddress.padStart(64, '0');

  // Convert to Uint8Array
  return new Uint8Array(
    paddedAddress.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
}

/**
 * Format EVM address to 32-byte hex string for CCTP (with 0x prefix)
 *
 * @param address - EVM address (with or without 0x prefix)
 * @returns 32-byte address as hex string with 0x prefix
 */
export function formatAddressForCCTPHex(address: string): string {
  const bytes = formatAddressForCCTP(address);
  return ensureHexPrefix(Buffer.from(bytes).toString('hex'));
}

/**
 * Parse an EVM address from CCTP 32-byte format
 * Extracts the last 20 bytes (EVM address portion)
 *
 * @param bytes - 32-byte CCTP address as Uint8Array
 * @returns EVM address with 0x prefix
 */
export function parseAddressFromCCTP(bytes: Uint8Array): string {
  // CCTP stores addresses as 32 bytes, but EVM addresses are only 20 bytes
  // Extract the last 20 bytes
  const addressBytes = bytes.slice(-20);
  const address = `0x${Buffer.from(addressBytes).toString('hex')}`;
  return address;
}

// ============================================================================
// Address Validation
// ============================================================================

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

// ============================================================================
// IBC Utilities
// ============================================================================

/**
 * IBC transfer timeout duration in minutes
 */
const IBC_TIMEOUT_MINUTES = 10;

/**
 * Calculate IBC timeout timestamp (current time + timeout duration)
 * Returns timestamp in nanoseconds as required by IBC protocol
 */
export function getIBCTimeoutTimestamp(): bigint {
  return BigInt(Date.now() + IBC_TIMEOUT_MINUTES * 60 * 1000) * BigInt(1_000_000);
}
