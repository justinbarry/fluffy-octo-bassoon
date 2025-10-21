import { useState, useEffect } from 'react';
import { TurnkeySigner } from '@turnkey/ethers';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { SigningStargateClient, GasPrice, defaultRegistryTypes } from '@cosmjs/stargate';
import { Registry } from '@cosmjs/proto-signing';
import { TurnkeyDirectWallet } from '@turnkey/cosmjs';
import { sources, bridge } from '@/config';
import { convertXionToNoble } from '@/utils/addressConversion';
import { createTurnkeyBaseSigner } from '@/utils/turnkeyBase';
import { getOrganizationId } from '@/utils/turnkeyWallet';
import { MsgDepositForBurn, MsgDepositForBurnWithCaller } from '@/proto/circle/cctp/v1/tx';

interface WalletClientsReturn {
  // Query clients
  xionQueryClient: CosmWasmClient | null;
  nobleQueryClient: CosmWasmClient | null;

  // Signing clients
  xionSigningClient: SigningStargateClient | null;
  nobleSigningClient: SigningStargateClient | null;
  baseSigner: TurnkeySigner | null;

  // Addresses
  xionAddress: string;
  nobleAddress: string;
  baseAddress: string;
}

export function useWalletClients(
  httpClient: any,
  firstWallet: any
): WalletClientsReturn {
  // Query clients
  const [xionQueryClient, setXionQueryClient] = useState<CosmWasmClient | null>(null);
  const [nobleQueryClient, setNobleQueryClient] = useState<CosmWasmClient | null>(null);

  // Signing clients
  const [xionSigningClient, setXionSigningClient] = useState<SigningStargateClient | null>(null);
  const [nobleSigningClient, setNobleSigningClient] = useState<SigningStargateClient | null>(null);
  const [baseSigner, setBaseSigner] = useState<TurnkeySigner | null>(null);

  // Addresses
  const [xionAddress, setXionAddress] = useState<string>('');
  const [nobleAddress, setNobleAddress] = useState<string>('');
  const [baseAddress, setBaseAddress] = useState<string>('');

  // Initialize query clients
  useEffect(() => {
    const initQueryClients = async () => {
      try {
        const xionClient = await CosmWasmClient.connect(sources.xion.rpcUrl);
        setXionQueryClient(xionClient);

        const nobleClient = await CosmWasmClient.connect(bridge.rpcUrl);
        setNobleQueryClient(nobleClient);

        console.log('✅ Query clients initialized');
      } catch (error) {
        console.error('Failed to connect query clients:', error);
      }
    };
    initQueryClients();
  }, []);

  // Initialize signing clients
  useEffect(() => {
    const initSigningClients = async () => {
      if (!httpClient || !firstWallet?.accounts?.[0]) {
        setXionSigningClient(null);
        setNobleSigningClient(null);
        setBaseSigner(null);
        setXionAddress('');
        setNobleAddress('');
        setBaseAddress('');
        return;
      }

      try {
        const rootOrgId = process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '';

        // Get the actual organization ID (sub-org)
        const actualOrgId = await getOrganizationId(httpClient, rootOrgId);
        console.log('🔑 Using organization ID:', actualOrgId);
        console.log('   Root org:', rootOrgId);
        console.log('   Is sub-org:', actualOrgId !== rootOrgId);

        // Find accounts in the multi-chain wallet
        console.log('🔍 Searching for multi-chain wallet accounts...');
        console.log('   Total wallets:', Array.isArray(firstWallet) ? firstWallet.length : 1);

        const allWallets = Array.isArray(firstWallet) ? firstWallet : [firstWallet];
        let cosmosUncompressedAccount = null;
        let ethereumAccount = null;

        // All accounts should be in the first wallet
        const wallet = allWallets[0];
        if (!wallet?.accounts) {
          throw new Error('No wallet accounts found. Please re-authenticate.');
        }

        console.log('   Found wallet with', wallet.accounts.length, 'accounts');

        for (const account of wallet.accounts) {
          console.log(`   - ${account.addressFormat} (${account.curve}): ${account.address.slice(0, 20)}...`);
          console.log(`     Wallet Account ID: ${account.walletAccountId}`);

          // Find Cosmos UNCOMPRESSED account for signing
          if (account.curve === 'CURVE_SECP256K1' && account.addressFormat === 'ADDRESS_FORMAT_UNCOMPRESSED') {
            cosmosUncompressedAccount = account;
            console.log('     ✓ Found Cosmos signing key (UNCOMPRESSED)');
          }

          // Find Ethereum account for EVM chains
          if (account.curve === 'CURVE_SECP256K1' && account.addressFormat === 'ADDRESS_FORMAT_ETHEREUM') {
            ethereumAccount = account;
            console.log('     ✓ Found Ethereum account');
            console.log(`     ✓ Ethereum wallet account ID: ${account.walletAccountId}`);
          }
        }

        if (!cosmosUncompressedAccount) {
          throw new Error('No Cosmos UNCOMPRESSED account found. Please re-authenticate with the new configuration.');
        }

        if (!ethereumAccount) {
          throw new Error('No Ethereum account found. Please re-authenticate with the new configuration.');
        }

        // Use the uncompressed public key (raw key) for Cosmos signing
        const signWith = cosmosUncompressedAccount.address || '';

        console.log('✅ Found all required accounts:');
        console.log('   Cosmos signWith (UNCOMPRESSED):', signWith.slice(0, 20) + '...');
        console.log('   Ethereum address:', ethereumAccount.address);
        console.log('   Ethereum account object:', JSON.stringify(ethereumAccount, null, 2));

        // Initialize Xion wallet with SUB-ORG ID (not root org)
        const xionWallet = await TurnkeyDirectWallet.init({
          config: {
            client: httpClient as any,
            organizationId: actualOrgId,
            signWith,
          },
          prefix: 'xion',
        });

        const accounts = await xionWallet.getAccounts();
        const xionAddr = accounts?.[0]?.address;
        if (xionAddr) {
          setXionAddress(xionAddr);
          // Convert to Noble address
          setNobleAddress(convertXionToNoble(xionAddr));
        }

        // Connect Xion client
        const xionClient = await SigningStargateClient.connectWithSigner(
          sources.xion.rpcUrl,
          xionWallet,
          { gasPrice: GasPrice.fromString('0.001uxion') }
        );
        setXionSigningClient(xionClient);

        // Initialize Noble wallet with SUB-ORG ID (not root org)
        const nobleWallet = await TurnkeyDirectWallet.init({
          config: {
            client: httpClient as any,
            organizationId: actualOrgId,
            signWith,
          },
          prefix: 'noble',
        });

        const nobleRegistry = new Registry([
          ...defaultRegistryTypes,
          [MsgDepositForBurn.typeUrl, MsgDepositForBurn as any],
          [MsgDepositForBurnWithCaller.typeUrl, MsgDepositForBurnWithCaller as any],
        ] as Iterable<[string, any]>);

        const nobleClient = await SigningStargateClient.connectWithSigner(
          bridge.rpcUrl,
          nobleWallet,
          {
            gasPrice: GasPrice.fromString('0.025uusdc'),
            registry: nobleRegistry,
          }
        );
        setNobleSigningClient(nobleClient);

        // Initialize Base signer with Turnkey using ethers
        try {
          console.log('🔧 Initializing Base signer with ethers...');
          const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
          const signer = await createTurnkeyBaseSigner(
            httpClient,
            actualOrgId,
            signWith, // Use the SAME uncompressed public key as Cosmos chains
            network as 'mainnet' | 'sepolia'
          );

          const address = await signer.getAddress();
          setBaseAddress(address);
          setBaseSigner(signer);
          console.log('✅ Base ethers signer created');
        } catch (error) {
          console.error('❌ Failed to create Base signer:', error);
          throw error;
        }

        console.log('✅ All signing clients initialized');
        console.log('📊 Final addresses:', {
          xion: xionAddr,
          noble: convertXionToNoble(xionAddr || ''),
          base: ethereumAccount.address
        });
      } catch (error) {
        console.error('Failed to initialize signing clients:', error);
        setXionSigningClient(null);
        setNobleSigningClient(null);
        setBaseSigner(null);
      }
    };

    initSigningClients();
  }, [httpClient, firstWallet?.accounts?.[0]?.address]);

  return {
    xionQueryClient,
    nobleQueryClient,
    xionSigningClient,
    nobleSigningClient,
    baseSigner,
    xionAddress,
    nobleAddress,
    baseAddress,
  };
}
