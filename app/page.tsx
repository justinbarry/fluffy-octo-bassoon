'use client';

import React, { useState, useEffect } from 'react';
import { useTurnkey, AuthState } from '@turnkey/react-wallet-kit';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { SigningStargateClient, GasPrice, defaultRegistryTypes } from '@cosmjs/stargate';
import { Registry } from '@cosmjs/proto-signing';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';
import { TurnkeyDirectWallet } from '@turnkey/cosmjs';
import { TurnkeySigner } from '@turnkey/solana';
import { CoinflowWithdraw } from '@coinflowlabs/react';
import { Buffer } from 'buffer';

import {
  XION_RPC_URL,
  XION_REST_URL,
  NOBLE_RPC_URL,
  SOLANA_RPC_URL,
  COINFLOW_API,
  COINFLOW_MERCHANT_ID,
  COINFLOW_BASE_URL,
  NOBLE_CONFIG,
  SOLANA_CONFIG,
  SOLANA_USDC_MINT,
} from '@/config/api';
import { convertXionToNoble } from '@/utils/addressConversion';

import { burnUSDCOnNoble, formatUSDCAmount } from '@/utils/cctpNoble';
import { getAttestationSignature, normalizeAttestation, normalizeMessageBytes } from '@/utils/cctp';
import { mintUSDCOnSolanaWithTurnkey, getSolanaUSDCBalance } from '@/utils/cctpSolana';
import { MsgDepositForBurn, MsgDepositForBurnWithCaller } from '@/proto/circle/cctp/v1/tx';
import { getOrganizationId } from '@/utils/turnkeyWallet';

// USDC denom on Xion
const USDC_DENOM = process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
  ? 'ibc/F082B65C88E4B6D5EF1DB243CDA1D331D002759E938A0F5CD3FFDC5D53B3E349'
  : 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4';

type CCTPStep = 'idle' | 'ibc' | 'burn' | 'attest' | 'mint' | 'complete';

interface TxHashes {
  ibcTransfer?: string;
  nobleBurn?: string;
  solanaMint?: string;
}

export default function Home() {
  // Turnkey (Xion/Noble) wallet state
  const {
    authState,
    user,
    wallets,
    handleLogin,
    httpClient
  } = useTurnkey();

  // Cosmos clients
  const [xionSigningClient, setXionSigningClient] = useState<SigningStargateClient | null>(null);
  const [nobleSigningClient, setNobleSigningClient] = useState<SigningStargateClient | null>(null);
  const [xionQueryClient, setXionQueryClient] = useState<CosmWasmClient | null>(null);
  const [nobleQueryClient, setNobleQueryClient] = useState<CosmWasmClient | null>(null);

  // Solana client and signer
  const [solanaSigner, setSolanaSigner] = useState<TurnkeySigner | null>(null);
  const [solanaConnection] = useState<Connection>(() => new Connection(SOLANA_RPC_URL, 'confirmed'));

  // Account state
  const [xionAddress, setXionAddress] = useState<string>('');
  const [nobleAddress, setNobleAddress] = useState<string>('');
  const [solanaAddress, setSolanaAddress] = useState<string>('');

  // Balance state
  const [xionUsdcBalance, setXionUsdcBalance] = useState<string>('0');
  const [nobleUsdcBalance, setNobleUsdcBalance] = useState<string>('0');
  const [solanaUsdcBalance, setSolanaUsdcBalance] = useState<number>(0);

  // CCTP flow state
  const [cctpStep, setCctpStep] = useState<CCTPStep>('idle');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [txHashes, setTxHashes] = useState<TxHashes>({});
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [nobleToXionAmount, setNobleToXionAmount] = useState<string>('');
  const [nobleToSolanaAmount, setNobleToSolanaAmount] = useState<string>('');

  const firstWallet = Array.isArray(wallets) ? wallets[0] : wallets;

  // Initialize Xion and Noble query clients
  useEffect(() => {
    const initQueryClients = async () => {
      try {
        const xionClient = await CosmWasmClient.connect(XION_RPC_URL);
        setXionQueryClient(xionClient);

        const nobleClient = await CosmWasmClient.connect(NOBLE_RPC_URL);
        setNobleQueryClient(nobleClient);

        console.log('✅ Query clients initialized');
      } catch (error) {
        console.error('Failed to connect query clients:', error);
      }
    };
    initQueryClients();
  }, []);

  // Initialize Xion, Noble, and Solana signing clients
  useEffect(() => {
    const initSigningClients = async () => {
      if (!httpClient || !firstWallet?.accounts?.[0]) {
        setXionSigningClient(null);
        setNobleSigningClient(null);
        setSolanaSigner(null);
        setXionAddress('');
        setNobleAddress('');
        setSolanaAddress('');
        return;
      }

      try {
        const rootOrgId = process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '';

        // Get the actual organization ID (sub-org)
        const actualOrgId = await getOrganizationId(httpClient, rootOrgId);
        console.log('🔑 Using organization ID:', actualOrgId);
        console.log('   Root org:', rootOrgId);
        console.log('   Is sub-org:', actualOrgId !== rootOrgId);

        // Find the secp256k1 wallet for Cosmos (Xion/Noble)
        console.log('🔍 Searching through all wallets for secp256k1 (Cosmos)...');
        console.log('   Total wallets:', Array.isArray(wallets) ? wallets.length : 1);

        let cosmosWalletAccount = null;
        const allWallets = Array.isArray(wallets) ? wallets : [wallets];

        for (const wallet of allWallets) {
          if (!wallet?.accounts) continue;

          for (const account of wallet.accounts) {
            console.log(`   Checking wallet account: ${account.walletAccountId}`);
            console.log(`     Curve: ${account.curve}`);
            console.log(`     Address Format: ${account.addressFormat}`);
            console.log(`     Address: ${account.address}`);

            // Use UNCOMPRESSED format (raw public key) for signWith
            if (account.curve === 'CURVE_SECP256K1' && account.addressFormat === 'ADDRESS_FORMAT_UNCOMPRESSED') {
              cosmosWalletAccount = account;
              console.log('✅ Found secp256k1 wallet with UNCOMPRESSED format (raw key)!');
              break;
            }
          }

          if (cosmosWalletAccount) break;
        }

        if (!cosmosWalletAccount) {
          throw new Error(
            'No secp256k1 wallet with ADDRESS_FORMAT_UNCOMPRESSED found. Please re-authenticate.'
          );
        }

        // Use the uncompressed public key (raw key) for signWith
        const signWith = cosmosWalletAccount.address || '';

        console.log('🔑 Using signWith (raw public key):', signWith);
        console.log('   Address format:', cosmosWalletAccount.addressFormat);
        console.log('   Length:', signWith.length);
        console.log('   Is hex:', /^[0-9a-fA-F]+$/.test(signWith));

        // Initialize Xion wallet with SUB-ORG ID (not root org)
        const xionWallet = await TurnkeyDirectWallet.init({
          config: {
            client: httpClient,
            organizationId: actualOrgId, // ← Use sub-org ID!
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
          XION_RPC_URL,
          xionWallet,
          { gasPrice: GasPrice.fromString('0.001uxion') }
        );
        setXionSigningClient(xionClient);

        // Initialize Noble wallet with SUB-ORG ID (not root org)
        const nobleWallet = await TurnkeyDirectWallet.init({
          config: {
            client: httpClient,
            organizationId: actualOrgId, // ← Use sub-org ID!
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
          NOBLE_RPC_URL,
          nobleWallet,
          {
            gasPrice: GasPrice.fromString('0.025uusdc'),
            registry: nobleRegistry,
          }
        );
        setNobleSigningClient(nobleClient);

        // Initialize Solana signer with SUB-ORG ID
        const solanaTurnkeySigner = new TurnkeySigner({
          organizationId: actualOrgId, // ← Use sub-org ID!
          client: httpClient,
        });
        setSolanaSigner(solanaTurnkeySigner);

        // Get or create Solana wallet (client-side with passkey auth)
        let solanaWalletAddress = '';
        try {

          console.log('📝 Getting or creating Solana wallet...');
          console.log('   Root org ID:', rootOrgId);
          console.log('   Actual org ID:', actualOrgId);

          // First, check if we already have a Solana wallet
          const walletsResponse = await httpClient.getWallets({
            organizationId: actualOrgId,
          });

          // Look for existing Solana wallet
          const wallets = walletsResponse.wallets || [];

          for (const wallet of wallets) {
            const accountsResponse = await httpClient.getWalletAccounts({
              organizationId: actualOrgId,
              walletId: wallet.walletId,
            });

            const solanaAccount = accountsResponse.accounts?.find(
              (account: any) => account.addressFormat === 'ADDRESS_FORMAT_SOLANA'
            );

            if (solanaAccount?.address) {
              console.log('✅ Found existing Solana wallet');
              console.log('   Solana address:', solanaAccount.address);
              console.log('   Solana address length:', solanaAccount.address.length);
              solanaWalletAddress = solanaAccount.address;
              break;
            }
          }

          // If no Solana wallet found, create one
          if (!solanaWalletAddress) {
            console.log('📝 Creating new Solana wallet...');

            const createWalletResult = await httpClient.createWallet({
              organizationId: actualOrgId,
              walletName: 'Solana Wallet',
              accounts: [
                {
                  curve: 'CURVE_ED25519',
                  pathFormat: 'PATH_FORMAT_BIP32',
                  path: "m/44'/501'/0'/0'",
                  addressFormat: 'ADDRESS_FORMAT_SOLANA',
                },
              ],
            });

            solanaWalletAddress = createWalletResult.addresses?.[0] || '';
            console.log('✅ Created Solana wallet:', solanaWalletAddress);
          }

          console.log('📍 Setting Solana address:', solanaWalletAddress);
          setSolanaAddress(solanaWalletAddress);

          // Verify state was set
          console.log('✅ Solana address state updated');
        } catch (error) {
          console.error('❌ Failed to get/create Solana wallet:', error);
          console.warn('⚠️ Continuing without Solana');
          setSolanaAddress('');
        }

        console.log('✅ All signing clients initialized');
        console.log('📊 Final addresses:', {
          xion: xionAddr,
          noble: convertXionToNoble(xionAddr || ''),
          solana: solanaWalletAddress
        });
      } catch (error) {
        console.error('Failed to initialize signing clients:', error);
        setXionSigningClient(null);
        setNobleSigningClient(null);
        setSolanaSigner(null);
      }
    };

    initSigningClients();
  }, [httpClient, firstWallet?.accounts?.[0]?.address]);

  // Fetch Xion USDC balance
  useEffect(() => {
    const fetchXionBalance = async () => {
      if (!xionAddress || !xionQueryClient) return;

      try {
        const balance = await xionQueryClient.getBalance(xionAddress, USDC_DENOM);
        setXionUsdcBalance((parseInt(balance.amount) / 1000000).toFixed(2));
      } catch (error) {
        console.error('Error fetching Xion balance:', error);
      }
    };

    fetchXionBalance();
    const interval = setInterval(fetchXionBalance, 10000);
    return () => clearInterval(interval);
  }, [xionAddress, xionQueryClient]);

  // Fetch Noble USDC balance
  useEffect(() => {
    const fetchNobleBalance = async () => {
      if (!nobleAddress || !nobleQueryClient) return;

      try {
        const balance = await nobleQueryClient.getBalance(nobleAddress, 'uusdc');
        setNobleUsdcBalance((parseInt(balance.amount) / 1000000).toFixed(2));
      } catch (error) {
        console.error('Error fetching Noble balance:', error);
      }
    };

    fetchNobleBalance();
    const interval = setInterval(fetchNobleBalance, 10000);
    return () => clearInterval(interval);
  }, [nobleAddress, nobleQueryClient]);

  // Fetch Solana USDC balance
  useEffect(() => {
    const fetchSolanaBalance = async () => {
      if (!solanaAddress) return;

      try {
        const publicKey = new PublicKey(solanaAddress);
        const balance = await getSolanaUSDCBalance(solanaConnection, publicKey);
        setSolanaUsdcBalance(balance);
      } catch (error) {
        console.error('Error fetching Solana balance:', error);
      }
    };

    fetchSolanaBalance();
    const interval = setInterval(fetchSolanaBalance, 10000);
    return () => clearInterval(interval);
  }, [solanaAddress, solanaConnection]);

  // CCTP Transfer Handler
  const handleCCTPTransfer = async () => {
    console.log('🚀 Starting CCTP transfer...');
    console.log('   Addresses:', { xionAddress, nobleAddress, solanaAddress });
    console.log('   Clients:', {
      xionSigning: !!xionSigningClient,
      nobleSigning: !!nobleSigningClient,
      solanaSigner: !!solanaSigner,
      xionQuery: !!xionQueryClient,
      nobleQuery: !!nobleQueryClient
    });

    if (!xionAddress || !nobleAddress || !solanaAddress) {
      setError('Please connect Turnkey wallet (Xion, Noble, and Solana addresses required)');
      return;
    }

    if (!xionSigningClient || !nobleSigningClient || !nobleQueryClient) {
      setError('Signing clients not initialized. Please wait for connection to complete.');
      return;
    }

    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');
    setTxHashes({});

    try {
      // Step 1: IBC Transfer from Xion to Noble
      setCctpStep('ibc');
      setStatusMessage('Transferring USDC from Xion to Noble via IBC...');

      const ibcHash = await transferUSDCToNoble(transferAmount);
      setTxHashes(prev => ({ ...prev, ibcTransfer: ibcHash }));

      // Wait for IBC settlement
      setStatusMessage('Waiting for IBC settlement (~8 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Query actual Noble balance after IBC transfer
      setStatusMessage('Checking Noble balance...');
      const nobleBalance = await nobleQueryClient!.getBalance(nobleAddress, 'uusdc');
      const nobleBalanceInMicroUnits = parseInt(nobleBalance.amount);

      console.log('💰 Noble balance after IBC:', {
        balance: nobleBalanceInMicroUnits,
        balanceUSDC: (nobleBalanceInMicroUnits / 1000000).toFixed(6)
      });

      // Step 2: Burn USDC on Noble (subtract gas fee)
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      // Calculate Solana USDC Associated Token Account (ATA) address
      // CRITICAL: CCTP must mint to the token account, not the wallet address
      const solanaPublicKey = new PublicKey(solanaAddress);
      const usdcMint = new PublicKey(SOLANA_USDC_MINT);
      const solanaUsdcAta = await getAssociatedTokenAddress(usdcMint, solanaPublicKey);
      const solanaAtaBytes = '0x' + Buffer.from(solanaUsdcAta.toBytes()).toString('hex');

      console.log('🎯 Solana CCTP destination:', {
        wallet: solanaAddress,
        usdcMint: SOLANA_USDC_MINT,
        ata: solanaUsdcAta.toBase58(),
        ataBytes: solanaAtaBytes
      });

      // Reserve gas fee from actual Noble balance
      const gasFeeBuffer = 40000; // 0.04 USDC
      const burnAmountFromNoble = Math.floor(nobleBalanceInMicroUnits - gasFeeBuffer);

      if (burnAmountFromNoble <= 0) {
        throw new Error('Insufficient Noble balance after IBC transfer. Need at least 0.04 USDC for gas.');
      }

      console.log('🔥 Burning on Noble:', {
        nobleBalance: nobleBalanceInMicroUnits,
        gasFeeBuffer,
        burnAmount: burnAmountFromNoble,
        burnUSDC: (burnAmountFromNoble / 1000000).toFixed(6)
      });

      // Use Coinflow's trusted relayer for Solana destination
      const SOLANA_RELAYER = '0xbac7599ecaaab190705ffff99f0625f33a4caf6b3ccccd0fa6cc0cc988e31ce1';

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient!,
        nobleAddress,
        burnAmountFromNoble.toString(),
        SOLANA_CONFIG.CCTP_DOMAIN, // Domain 5 for Solana
        solanaAtaBytes, // Use ATA address, not wallet address
        SOLANA_RELAYER // Coinflow's relayer will complete the mint
      );
      setTxHashes(prev => ({ ...prev, nobleBurn: burnResult.transactionHash }));

      // Step 3: Get Circle attestation
      setCctpStep('attest');
      setStatusMessage('Fetching attestation from Circle (this may take 2-3 minutes)...');

      const { attestation, message } = await getAttestationSignature(
        burnResult.transactionHash,
        240, // max attempts (20 minutes)
        5000 // poll every 5 seconds
      );

      const attestationHex = normalizeAttestation(attestation);
      const messageHex = normalizeMessageBytes(burnResult.messageBytes || message);

      if (!attestationHex || !messageHex) {
        throw new Error('Failed to retrieve attestation or message bytes');
      }

      // Step 4: Mint USDC on Solana
      setCctpStep('mint');
      setStatusMessage('Minting USDC on Solana...');

      if (!solanaSigner) {
        throw new Error('Solana signer not initialized');
      }

      const mintResult = await mintUSDCOnSolanaWithTurnkey(
        solanaConnection,
        solanaSigner,
        solanaAddress,
        messageHex,
        attestationHex
      );

      if (!mintResult.success) {
        throw new Error('Failed to mint USDC on Solana');
      }

      setTxHashes(prev => ({ ...prev, solanaMint: mintResult.transactionHash }));

      // Success!
      setCctpStep('complete');
      setStatusMessage('CCTP transfer complete! You can now withdraw with Coinflow.');
      setTransferAmount('');

    } catch (err: any) {
      console.error('CCTP transfer error:', err);
      setError(err.message || 'CCTP transfer failed');
      setCctpStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // IBC Transfer function
  const transferUSDCToNoble = async (amount: string): Promise<string> => {
    if (!xionAddress || !nobleAddress || !xionSigningClient) {
      throw new Error('Xion signing client not available');
    }

    const ibcMsg = {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: MsgTransfer.fromPartial({
        sourcePort: 'transfer',
        sourceChannel: process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
          ? 'channel-2'
          : 'channel-3',
        token: {
          denom: USDC_DENOM,
          amount: `${parseInt(amount) * 1000000}`,
        },
        sender: xionAddress,
        receiver: nobleAddress,
        timeoutHeight: undefined,
        timeoutTimestamp: BigInt(Date.now() + 10 * 60 * 1000) * BigInt(1000000),
        memo: 'CCTP transfer to Solana',
      }),
    };

    const result = await xionSigningClient.signAndBroadcast(
      xionAddress,
      [ibcMsg],
      'auto',
      'IBC transfer to Noble for CCTP'
    );

    if (result.code !== 0) {
      throw new Error(`IBC transfer failed: ${result.rawLog}`);
    }

    console.log('✅ IBC transfer successful:', result.transactionHash);
    return result.transactionHash;
  };

  // Reset flow
  const resetFlow = () => {
    setCctpStep('idle');
    setTxHashes({});
    setError('');
    setStatusMessage('');
    setTransferAmount('');
  };

  // IBC Transfer Noble → Xion
  const transferNobleToXion = async (inputAmount?: string) => {
    if (!nobleAddress || !xionAddress || !nobleSigningClient || !nobleQueryClient) {
      setError('Noble signing client not available');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatusMessage('Transferring USDC from Noble back to Xion...');

      // Query fresh Noble balance
      const freshNobleBalance = await nobleQueryClient.getBalance(nobleAddress, 'uusdc');
      const balanceInMicroUnits = parseInt(freshNobleBalance.amount);

      // Reserve gas fee (0.025 USDC)
      const gasFeeBuffer = 25000; // 0.025 USDC for gas

      // Calculate transfer amount
      let transferAmount: number;
      if (inputAmount && parseFloat(inputAmount) > 0) {
        // Use specified amount
        const requestedAmount = Math.floor(parseFloat(inputAmount) * 1000000);
        if (requestedAmount + gasFeeBuffer > balanceInMicroUnits) {
          throw new Error('Insufficient balance for requested amount plus gas fees.');
        }
        transferAmount = requestedAmount;
      } else {
        // Transfer all (minus gas)
        transferAmount = balanceInMicroUnits - gasFeeBuffer;
      }

      if (transferAmount <= 0) {
        throw new Error('Insufficient balance. Need at least 0.025 USDC for gas fees.');
      }

      console.log('💰 IBC Transfer calculation:', {
        balance: balanceInMicroUnits,
        gasFeeBuffer,
        transferAmount,
        transferUSDC: (transferAmount / 1000000).toFixed(6)
      });

      const ibcMsg = {
        typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
        value: MsgTransfer.fromPartial({
          sourcePort: 'transfer',
          sourceChannel: process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet'
            ? 'channel-0' // Noble to Xion mainnet channel
            : 'channel-0', // Noble to Xion testnet channel
          token: {
            denom: 'uusdc',
            amount: transferAmount.toString(),
          },
          sender: nobleAddress,
          receiver: xionAddress,
          timeoutHeight: undefined,
          timeoutTimestamp: BigInt(Date.now() + 10 * 60 * 1000) * BigInt(1000000),
          memo: 'Return USDC to Xion',
        }),
      };

      const result = await nobleSigningClient.signAndBroadcast(
        nobleAddress,
        [ibcMsg],
        {
          amount: [{ denom: 'uusdc', amount: '25000' }],
          gas: '200000'
        },
        'IBC transfer back to Xion'
      );

      if (result.code !== 0) {
        throw new Error(`IBC transfer failed: ${result.rawLog}`);
      }

      console.log('✅ Noble → Xion transfer successful:', result.transactionHash);
      setStatusMessage(`Success! TX: ${result.transactionHash}`);

      // Refresh balances
      setTimeout(() => {
        setStatusMessage('');
      }, 5000);
    } catch (err: any) {
      console.error('Noble → Xion transfer error:', err);
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  // CCTP Burn Noble → Solana (skip Xion step)
  const burnNobleToSolana = async (inputAmount?: string) => {
    if (!nobleAddress || !solanaAddress || !nobleSigningClient || !solanaSigner) {
      setError('Noble or Solana signing client not available');
      return;
    }

    setLoading(true);
    setError('');
    setTxHashes({});

    try {
      // Step 1: Burn USDC on Noble
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      // Calculate Solana USDC Associated Token Account (ATA) address
      // CRITICAL: CCTP must mint to the token account, not the wallet address
      const solanaPublicKey = new PublicKey(solanaAddress);
      const usdcMint = new PublicKey(SOLANA_USDC_MINT);
      const solanaUsdcAta = await getAssociatedTokenAddress(usdcMint, solanaPublicKey);
      const solanaAtaBytes = '0x' + Buffer.from(solanaUsdcAta.toBytes()).toString('hex');

      console.log('🎯 Solana CCTP destination:', {
        wallet: solanaAddress,
        usdcMint: SOLANA_USDC_MINT,
        ata: solanaUsdcAta.toBase58(),
        ataBytes: solanaAtaBytes
      });

      // Query fresh Noble balance before burning
      const freshNobleBalance = await nobleQueryClient!.getBalance(nobleAddress, 'uusdc');
      const balanceInMicroUnits = parseInt(freshNobleBalance.amount);
      const gasFeeBuffer = 40000; // 0.04 USDC buffer for gas fees

      // Calculate burn amount
      let burnAmount: number;
      if (inputAmount && parseFloat(inputAmount) > 0) {
        // Use specified amount
        const requestedAmount = Math.floor(parseFloat(inputAmount) * 1000000);
        if (requestedAmount + gasFeeBuffer > balanceInMicroUnits) {
          throw new Error('Insufficient balance for requested amount plus gas fees.');
        }
        burnAmount = requestedAmount;
      } else {
        // Burn all (minus gas)
        burnAmount = balanceInMicroUnits - gasFeeBuffer;
      }

      if (burnAmount <= 0) {
        throw new Error('Insufficient balance. Need at least 0.04 USDC for gas fees.');
      }

      // Ensure it's a valid integer string (no decimals, no scientific notation)
      const burnAmountString = Math.floor(burnAmount).toString();

      console.log('💰 Burn calculation:', {
        balanceStr: freshNobleBalance.amount,
        balance: balanceInMicroUnits,
        gasFeeBuffer,
        burnAmount,
        burnAmountString,
        burnUSDC: (burnAmount / 1000000).toFixed(6)
      });

      // Use Coinflow's trusted relayer for Solana destination
      const SOLANA_RELAYER = '0xbac7599ecaaab190705ffff99f0625f33a4caf6b3ccccd0fa6cc0cc988e31ce1';

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient,
        nobleAddress,
        burnAmountString,
        SOLANA_CONFIG.CCTP_DOMAIN,
        solanaAtaBytes, // Use ATA address, not wallet address
        SOLANA_RELAYER // Coinflow's relayer will complete the mint
      );
      setTxHashes({ nobleBurn: burnResult.transactionHash });

      // When using a relayer (MsgDepositForBurnWithCaller), the relayer handles
      // attestation and minting automatically. We just wait for it to complete.
      setCctpStep('mint');
      setStatusMessage('Waiting for Coinflow relayer to complete the mint on Solana (this may take 2-3 minutes)...');

      console.log('🔄 Relayer-based transfer initiated. Coinflow will handle attestation and minting.');
      console.log('   Burn TX:', burnResult.transactionHash);
      console.log('   Monitor your Solana balance for the incoming USDC.');

      // Poll Solana balance to detect when funds arrive
      const initialBalance = solanaUsdcBalance;
      const startTime = Date.now();
      const maxWaitTime = 5 * 60 * 1000; // 5 minutes max

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds

        // Fetch current balance
        const publicKey = new PublicKey(solanaAddress);
        const currentBalance = await getSolanaUSDCBalance(solanaConnection, publicKey);

        console.log('💰 Checking Solana balance:', {
          initial: initialBalance,
          current: currentBalance,
          elapsed: `${Math.floor((Date.now() - startTime) / 1000)}s`
        });

        if (currentBalance > initialBalance) {
          console.log('✅ Funds detected on Solana! Transfer complete.');
          setSolanaUsdcBalance(currentBalance);
          break;
        }
      }

      // Success!
      setCctpStep('complete');
      setStatusMessage('CCTP Noble → Solana complete!');

      setTimeout(() => {
        resetFlow();
      }, 5000);

    } catch (err: any) {
      console.error('Noble → Solana CCTP error:', err);
      setError(err.message || 'CCTP transfer failed');
      setCctpStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // Debug: Call Turnkey whoami endpoint
  const debugWhoAmI = async () => {
    if (!httpClient) {
      console.error('❌ httpClient not available');
      return;
    }

    try {
      console.log('🔍 Calling Turnkey whoami endpoint...');
      const whoami = await httpClient.getWhoami({
        organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '',
      });
      console.log('✅ Whoami response:', whoami);
      console.log('📋 Full object:', JSON.stringify(whoami, null, 2));
      console.log('🔑 Organization ID from whoami:', whoami.organizationId);
      console.log('👤 User object from useTurnkey:', user);
      console.log('🔑 Organization ID from user:', (user as any)?.organizationId);
    } catch (error) {
      console.error('❌ Whoami error:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Xion → Solana CCTP
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Bridge USDC via Noble + Withdraw with Coinflow
        </p>

        {/* Wallet Connection Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Connect Wallets</h2>

          {/* Turnkey (Xion/Noble) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cosmos Chains (Xion/Noble)
            </label>
            <button
              onClick={() => {
                console.log('🔘 Connect button clicked');
                console.log('   Auth state:', authState);
                console.log('   Is authenticated:', authState === AuthState.Authenticated);
                console.log('   handleLogin type:', typeof handleLogin);

                if (authState !== AuthState.Authenticated) {
                  console.log('🚀 Calling handleLogin()...');
                  handleLogin();
                } else {
                  console.log('ℹ️ Already authenticated');
                }
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {xionAddress ? `Connected: ${xionAddress.slice(0, 12)}...` : 'Connect Turnkey'}
            </button>
            {xionAddress && (
              <div className="mt-2 text-sm text-gray-600">
                <div>Xion: {xionAddress}</div>
                <div>Noble: {nobleAddress}</div>
              </div>
            )}
          </div>

          {/* Solana - derived from Turnkey */}
          {solanaAddress && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700">Solana (Turnkey)</div>
              <div className="text-xs text-gray-600 mt-1 break-all font-mono">
                {solanaAddress}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(solanaAddress);
                  setStatusMessage('Solana address copied!');
                  setTimeout(() => setStatusMessage(''), 2000);
                }}
                className="mt-2 text-xs text-purple-600 hover:text-purple-800"
              >
                📋 Copy address
              </button>
            </div>
          )}

          {/* Debug Button - Always visible */}
          <div className="mt-4">
            <button
              onClick={debugWhoAmI}
              disabled={!httpClient}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              🔍 Debug: Call Turnkey whoami (check console)
            </button>
          </div>
        </div>

        {/* Balances */}
        {(xionAddress || solanaAddress) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Balances</h2>
            <div className="grid grid-cols-3 gap-4">
              {xionAddress && (
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <div className="text-sm text-gray-600">Xion USDC</div>
                  <div className="text-2xl font-bold">${xionUsdcBalance}</div>
                </div>
              )}
              {nobleAddress && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Noble USDC</div>
                  <div className="text-2xl font-bold">${nobleUsdcBalance}</div>
                  {parseFloat(nobleUsdcBalance) > 0 && (
                    <div className="mt-3 space-y-2">
                      {/* IBC to Xion */}
                      <div>
                        <input
                          type="number"
                          value={nobleToXionAmount}
                          onChange={(e) => setNobleToXionAmount(e.target.value)}
                          placeholder="Amount (or leave empty for all)"
                          disabled={loading}
                          className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1"
                        />
                        <button
                          onClick={() => transferNobleToXion(nobleToXionAmount)}
                          disabled={loading}
                          className="w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-1 px-2 rounded"
                        >
                          ← IBC to Xion
                        </button>
                      </div>
                      {/* CCTP to Solana */}
                      <div>
                        <input
                          type="number"
                          value={nobleToSolanaAmount}
                          onChange={(e) => setNobleToSolanaAmount(e.target.value)}
                          placeholder="Amount (or leave empty for all)"
                          disabled={loading || !solanaAddress}
                          className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1"
                        />
                        <button
                          onClick={() => burnNobleToSolana(nobleToSolanaAmount)}
                          disabled={loading || !solanaAddress}
                          className="w-full text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1 px-2 rounded"
                        >
                          → CCTP to Solana
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {solanaAddress && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Solana USDC</div>
                  <div className="text-2xl font-bold">${solanaUsdcBalance.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CCTP Transfer Section */}
        {cctpStep !== 'complete' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">CCTP Bridge</h2>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (USDC)
              </label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter amount"
                disabled={loading || cctpStep !== 'idle'}
              />
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800">{statusMessage}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Progress Steps */}
            {cctpStep !== 'idle' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  {['ibc', 'burn', 'attest', 'mint'].map((step, idx) => (
                    <div key={step} className="flex-1">
                      <div className={`h-2 rounded-full ${
                        cctpStep === step ? 'bg-indigo-600' :
                        ['ibc', 'burn', 'attest', 'mint'].indexOf(cctpStep) > idx ? 'bg-green-500' :
                        'bg-gray-200'
                      }`} />
                      <div className="text-xs text-center mt-1 text-gray-600">
                        {step.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction Hashes */}
            {Object.keys(txHashes).length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium mb-2">Transaction Hashes:</div>
                {txHashes.ibcTransfer && (
                  <div className="mb-1 break-all">
                    <span className="font-medium">IBC:</span> {txHashes.ibcTransfer}
                  </div>
                )}
                {txHashes.nobleBurn && (
                  <div className="mb-1 break-all">
                    <span className="font-medium">Burn:</span> {txHashes.nobleBurn}
                  </div>
                )}
                {txHashes.solanaMint && (
                  <div className="break-all">
                    <span className="font-medium">Mint:</span> {txHashes.solanaMint}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleCCTPTransfer}
                disabled={loading || cctpStep !== 'idle' || !xionAddress || !solanaAddress}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? 'Processing...' : 'Start CCTP Transfer'}
              </button>
              {cctpStep !== 'idle' && (
                <button
                  onClick={resetFlow}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Coinflow Withdrawal Widget */}
        {cctpStep === 'complete' && solanaAddress && solanaSigner && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">Withdraw to Bank Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              USDC has been successfully bridged to Solana via CCTP!
              <br />
              Use the Coinflow widget below to withdraw to your bank account.
            </p>
            {/* @ts-ignore - Coinflow expects specific wallet interface */}
            <CoinflowWithdraw
              wallet={{
                publicKey: new PublicKey(solanaAddress),
                signTransaction: async (tx: any) => await solanaSigner.signTransaction(tx, solanaAddress),
                signAllTransactions: async (txs: any[]) => await Promise.all(
                  txs.map(tx => solanaSigner.signTransaction(tx, solanaAddress))
                ),
              } as any}
              merchantId={COINFLOW_MERCHANT_ID}
              env={process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet' ? 'prod' : 'sandbox'}
              connection={solanaConnection}
              onSuccess={(data: any) => {
                console.log('Withdrawal successful:', data);
                alert('Withdrawal initiated successfully!');
                resetFlow();
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
