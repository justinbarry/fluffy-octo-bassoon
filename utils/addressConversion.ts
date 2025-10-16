/**
 * Address Conversion Utilities
 * Handles conversions between different blockchain address formats
 */

import { fromBech32, toBech32 } from '@cosmjs/encoding';

/**
 * Convert XION address to Noble address (both are Bech32 format)
 */
export function convertXionToNoble(xionAddress: string): string {
  try {
    if (xionAddress.startsWith('noble1')) {
      return xionAddress; // Already Noble format
    }

    if (xionAddress.startsWith('xion1')) {
      const { data } = fromBech32(xionAddress);
      return toBech32('noble', data);
    }

    return xionAddress;
  } catch (error) {
    console.error('Error converting XION to Noble address:', error);
    return xionAddress;
  }
}

/**
 * Validate Bech32 address format
 */
export function isValidBech32Address(address: string): boolean {
  try {
    fromBech32(address);
    return true;
  } catch {
    return false;
  }
}
