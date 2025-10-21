import { TurnkeyClient } from "@turnkey/http";
import { TurnkeySigner } from "@turnkey/ethers";
import { TypedDataDomain, TypedDataField, ethers } from "ethers";

/**
 * Sign EIP-712 typed data using Turnkey's Raw Digest Method
 * This method hashes the typed data and signs the hash directly (no policy enforcement)
 */
export async function signEIP712WithTurnkey(
  turnkeyClient: TurnkeyClient,
  organizationId: string,
  signWith: string,
  typedData: any
): Promise<string> {
  console.log('🔐 Signing EIP-712 data with Turnkey (Raw Digest Method):', {
    domain: typedData.domain,
    types: Object.keys(typedData.types),
    primaryType: typedData.primaryType || Object.keys(typedData.types).find(key => key !== 'EIP712Domain'),
  });

  try {
    // Step 1: Hash the typed data
    const types = { ...typedData.types };
    // Remove EIP712Domain from types as ethers handles it separately
    delete types.EIP712Domain;

    // Hash the typed data using ethers
    const hashedPayload = ethers.TypedDataEncoder.hash(
      typedData.domain,
      types,
      typedData.message
    );

    console.log('📊 Hashed EIP-712 payload:', hashedPayload);

    // Step 2: Sign the hash using Turnkey's Raw Digest Method
    const { activity, r, s, v } = await turnkeyClient.signRawPayload({
      organizationId: organizationId,
      signWith: signWith,
      payload: hashedPayload.slice(2), // Remove '0x' prefix
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
      hashFunction: "HASH_FUNCTION_NO_OP", // Already hashed, don't hash again
    });

    console.log('✅ Turnkey Raw Digest sign result:', {
      activityId: activity.id,
      status: activity.status,
      r: r.slice(0, 8) + '...',
      s: s.slice(0, 8) + '...',
      v: v
    });

    // v is returned as "00" or "01", convert to recovery ID (27 or 28)
    const vNum = parseInt(v, 16);
    const vHex = (vNum + 27).toString(16).padStart(2, '0');

    // Assemble the signature in the standard format: 0x + r + s + v
    const signature = `0x${r}${s}${vHex}`;

    console.log('✅ EIP-712 signature assembled:', signature.slice(0, 20) + '...');

    return signature;
  } catch (error: any) {
    console.error('❌ Failed to sign EIP-712 with Turnkey:', error);
    throw new Error(`EIP-712 signing failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Parse and validate EIP-712 typed data
 */
export function parseEIP712TypedData(message: string | any): any {
  try {
    const typedData = typeof message === 'string' ? JSON.parse(message) : message;

    // Validate required EIP-712 fields
    if (!typedData.domain || !typedData.types || !typedData.message) {
      throw new Error('Invalid EIP-712 typed data: missing required fields');
    }

    // Find primary type if not specified
    if (!typedData.primaryType) {
      typedData.primaryType = Object.keys(typedData.types).find(key => key !== 'EIP712Domain');
    }

    return typedData;
  } catch (error: any) {
    console.error('Failed to parse EIP-712 typed data:', error);
    throw new Error(`Invalid EIP-712 data: ${error.message}`);
  }
}