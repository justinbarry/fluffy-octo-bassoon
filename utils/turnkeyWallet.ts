/**
 * Turnkey Wallet Management Utilities
 * Handles creating and fetching wallet accounts across different blockchains
 */

/**
 * Get or create a Solana wallet account in Turnkey
 *
 * This function calls a server-side API route that:
 * 1. Checks if the wallet already has a Solana account
 * 2. If not, creates one using CREATE_WALLET_ACCOUNTS activity
 * 3. Returns the Solana address
 *
 * Note: Uses server-side API route because wallet queries/creation
 * require API key authentication (not passkey/WebAuthn)
 *
 * @param walletId - Existing wallet ID
 * @returns Solana address (base58 format)
 */
export async function getOrCreateSolanaAccount(
  walletId: string
): Promise<string> {
  console.log('🔍 Requesting Solana account from server API...');

  try {
    const response = await fetch('/api/turnkey/solana-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletId }),
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
 * Get wallet ID from Turnkey wallet accounts
 * In react-wallet-kit, the wallet ID should be available from the wallet object
 */
export function extractWalletId(wallet: any): string {
  // The wallet object from useTurnkey() should have a walletId
  // This may be in wallet.id, wallet.walletId, or wallet.accounts[0].walletId
  return wallet?.id || wallet?.walletId || '';
}
