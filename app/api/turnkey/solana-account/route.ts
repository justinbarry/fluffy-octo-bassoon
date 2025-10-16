import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export async function POST(request: NextRequest) {
  try {
    const { walletId } = await request.json();

    if (!walletId) {
      return NextResponse.json({ error: 'walletId is required' }, { status: 400 });
    }

    const organizationId = process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || process.env.TURNKEY_ORGANIZATION_ID;
    const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;

    if (!organizationId || !apiPublicKey || !apiPrivateKey) {
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
      defaultOrganizationId: organizationId,
    });

    console.log('🔍 Checking for existing Solana account...');

    // Get wallet accounts to check for existing Solana account
    const accountsResponse = await turnkeyClient.apiClient().getWalletAccounts({
      organizationId,
      walletId,
    });

    // Check if there's already a Solana account
    const accounts = accountsResponse.accounts || [];
    const solanaAccount = accounts.find(
      (account: any) => account.addressFormat === 'ADDRESS_FORMAT_SOLANA'
    );

    if (solanaAccount?.address) {
      console.log('✅ Found existing Solana account:', solanaAccount.address);
      return NextResponse.json({ address: solanaAccount.address });
    }

    // No Solana account found, create one
    console.log('📝 Creating new Solana wallet account...');

    const createAccountResult = await turnkeyClient.apiClient().createWalletAccounts({
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
      return NextResponse.json(
        { error: 'Failed to create Solana wallet account' },
        { status: 500 }
      );
    }

    console.log('✅ Created new Solana account:', newAddress);
    return NextResponse.json({ address: newAddress });

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
