/**
 * Turnkey Wallet Management Utilities
 * Handles creating and fetching wallet accounts across different blockchains
 */

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

interface WalletAccount {
  curve: string;
  pathFormat: string;
  path: string;
  addressFormat: string;
  address?: string;
}

interface CreateWalletAccountsParams {
  walletId: string;
  accounts: Array<{
    curve: 'CURVE_ED25519' | 'CURVE_SECP256K1';
    pathFormat: 'PATH_FORMAT_BIP32';
    path: string;
    addressFormat: string;
  }>;
}

/**
 * Get or create a Solana wallet account in Turnkey
 *
 * This function:
 * 1. Checks if the wallet already has a Solana account
 * 2. If not, creates one using CREATE_WALLET_ACCOUNTS activity
 * 3. Returns the Solana address
 *
 * @param httpClient - Turnkey HTTP client from react-wallet-kit
 * @param organizationId - Turnkey organization ID
 * @param walletId - Existing wallet ID
 * @returns Solana address (base58 format)
 */
export async function getOrCreateSolanaAccount(
  httpClient: any, // TurnkeySDKClientBase from react-wallet-kit
  organizationId: string,
  walletId: string
): Promise<string> {
  console.log('🔍 Checking for existing Solana account in Turnkey wallet...');

  try {
    // First, try to get wallet details to check for existing Solana account
    const walletResponse = await httpClient.getWallet({
      organizationId,
      walletId,
    });

    // Check if there's already a Solana account
    const accounts = walletResponse.wallet?.accounts || [];
    const solanaAccount = accounts.find(
      (account: any) => account.addressFormat === 'ADDRESS_FORMAT_SOLANA'
    );

    if (solanaAccount?.address) {
      console.log('✅ Found existing Solana account:', solanaAccount.address);
      return solanaAccount.address;
    }

    // No Solana account found, create one
    console.log('📝 No Solana account found. Creating new Solana wallet account...');

    const createAccountResult = await httpClient.createWalletAccounts({
      organizationId,
      walletId,
      accounts: [
        {
          curve: 'CURVE_ED25519',
          pathFormat: 'PATH_FORMAT_BIP32',
          path: SOLANA_DERIVATION_PATH,
          addressFormat: 'ADDRESS_FORMAT_SOLANA',
        },
      ],
    });

    const newAddress = createAccountResult.addresses?.[0];
    if (!newAddress) {
      throw new Error('Failed to create Solana wallet account');
    }

    console.log('✅ Created new Solana account:', newAddress);
    return newAddress;
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
