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
 * Get organization ID from httpClient using whoami
 * This is more reliable than trying to extract from user object
 */
export async function getOrganizationId(
  httpClient: any,
  rootOrgId: string
): Promise<string> {
  try {
    const whoami = await httpClient.getWhoami({
      organizationId: rootOrgId,
    });

    // whoami returns the actual org ID the user belongs to (sub-org or root)
    const orgId = whoami.organizationId;
    console.log('🔑 Organization ID from whoami:', orgId);
    console.log('   Organization name:', whoami.organizationName);
    console.log('   Is sub-org:', orgId !== rootOrgId);

    return orgId;
  } catch (error) {
    console.error('❌ Failed to get organization ID:', error);
    // Fall back to root org ID
    return rootOrgId;
  }
}
