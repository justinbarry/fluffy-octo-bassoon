import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";
const SOLANA_WALLET_NAME = 'Solana Wallet (Auto-Created)';

export async function POST(request: NextRequest) {
  try {
    const { subOrgId } = await request.json();

    if (!subOrgId) {
      return NextResponse.json({ error: 'subOrgId is required' }, { status: 400 });
    }

    const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;

    console.log('🔧 Creating/fetching Solana wallet in sub-org:', subOrgId);

    if (!apiPublicKey || !apiPrivateKey) {
      return NextResponse.json(
        { error: 'Turnkey API credentials not configured' },
        { status: 500 }
      );
    }

    // Initialize Turnkey client with API keys (server-side)
    const turnkeyClient = new Turnkey({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey,
      apiPrivateKey,
      defaultOrganizationId: subOrgId,
    });

    console.log('🔍 Checking for existing Solana wallet...');

    // List all wallets in the sub-org
    const walletsResponse = await turnkeyClient.apiClient().getWallets({
      organizationId: subOrgId,
    });

    // Check if there's already a Solana wallet
    const wallets = walletsResponse.wallets || [];
    for (const wallet of wallets) {
      // Get accounts for this wallet
      const accountsResponse = await turnkeyClient.apiClient().getWalletAccounts({
        organizationId: subOrgId,
        walletId: wallet.walletId,
      });

      const solanaAccount = accountsResponse.accounts?.find(
        (account: any) => account.addressFormat === 'ADDRESS_FORMAT_SOLANA'
      );

      if (solanaAccount?.address) {
        console.log('✅ Found existing Solana wallet:', wallet.walletId);
        console.log('   Address:', solanaAccount.address);
        return NextResponse.json({
          address: solanaAccount.address,
          walletId: wallet.walletId
        });
      }
    }

    // No Solana wallet found, create a new one
    console.log('📝 Creating new Solana wallet in sub-org...');

    const createWalletResult = await turnkeyClient.apiClient().createWallet({
      organizationId: subOrgId,
      walletName: SOLANA_WALLET_NAME,
      accounts: [
        {
          curve: 'CURVE_ED25519',
          pathFormat: 'PATH_FORMAT_BIP32',
          path: SOLANA_DERIVATION_PATH,
          addressFormat: 'ADDRESS_FORMAT_SOLANA',
        },
      ],
    });

    const newAddress = createWalletResult.addresses?.[0];
    const newWalletId = createWalletResult.walletId;

    if (!newAddress || !newWalletId) {
      return NextResponse.json(
        { error: 'Failed to create Solana wallet' },
        { status: 500 }
      );
    }

    console.log('✅ Created new Solana wallet:', newWalletId);
    console.log('   Address:', newAddress);
    return NextResponse.json({
      address: newAddress,
      walletId: newWalletId
    });

  } catch (error: any) {
    console.error('❌ Error in Solana account creation:', error);
    return NextResponse.json(
      {
        error: 'Failed to get or create Solana account',
        details: error.message
      },
      { status: 500 }
    );
  }
}
