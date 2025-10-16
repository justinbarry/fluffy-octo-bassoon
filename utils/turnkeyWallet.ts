/**
 * Turnkey Wallet Management Utilities
 * Handles creating and fetching wallet accounts across different blockchains
 */

/**
 * Get or create a Solana wallet in Turnkey sub-organization
 *
 * This function calls a server-side API route that:
 * 1. Checks if the sub-org already has a Solana wallet
 * 2. If not, creates a new wallet with ed25519 curve for Solana
 * 3. Returns the Solana address
 *
 * Note: Uses server-side API route because wallet queries/creation
 * require API key authentication (not passkey/WebAuthn)
 *
 * @param subOrgId - Sub-organization ID (where wallets live)
 * @returns Solana address (base58 format)
 */
export async function getOrCreateSolanaWallet(
  subOrgId: string
): Promise<string> {
  console.log('🔍 Requesting Solana wallet from server API...');

  try {
    const response = await fetch('/api/turnkey/solana-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subOrgId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get Solana account from server');
    }

    const data = await response.json();
    console.log('✅ Solana account:', data.address);
    return data.address;
  } catch (error) {
    console.error('❌ Error getting/creating Solana account:', error);
    throw new Error(`Failed to get or create Solana account: ${error}`);
  }
}

/**
 * Extract organization ID from Turnkey user object
 * Returns sub-org ID if user is in a sub-org, otherwise undefined
 * Caller should fall back to root org ID from environment
 */
export function extractSubOrgId(user: any): string | undefined {
  // Check various possible locations for organization ID
  const orgId = user?.organizationId ||
                user?.organization?.id ||
                user?.organization?.organizationId;

  console.log('🔍 Extracting org ID from user:', {
    hasOrganizationId: !!user?.organizationId,
    hasOrganization: !!user?.organization,
    userId: user?.userId,
    extracted: orgId
  });

  return orgId;
}
