import { NextRequest, NextResponse } from 'next/server';
import { Turnkey } from '@turnkey/sdk-server';

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export async function POST(request: NextRequest) {
  try {
    const { walletId, subOrgId } = await request.json();

    if (!walletId) {
      return NextResponse.json({ error: 'walletId is required' }, { status: 400 });
    }

    // Use sub-org ID if provided (for wallets in sub-organizations)
    // Otherwise fall back to root org ID
    const organizationId = subOrgId || process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || process.env.TURNKEY_ORGANIZATION_ID;
    const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;

    console.log('🔧 Using organization ID:', organizationId);
    console.log('   Is sub-org:', !!subOrgId);

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

    // No Solana account found
    console.log('⚠️ No Solana account found in wallet');
    console.log('📝 To create a Solana account, use the Turnkey dashboard or CLI:');
    console.log('   - Curve: CURVE_ED25519');
    console.log('   - Path: m/44\'/501\'/0\'/0\'');
    console.log('   - Address Format: ADDRESS_FORMAT_SOLANA');

    return NextResponse.json(
      {
        error: 'No Solana account found in wallet',
        message: 'Please create a Solana wallet account in Turnkey dashboard first',
        instructions: {
          curve: 'CURVE_ED25519',
          path: SOLANA_DERIVATION_PATH,
          addressFormat: 'ADDRESS_FORMAT_SOLANA'
        }
      },
      { status: 404 }
    );

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
