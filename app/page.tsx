'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTurnkey, AuthState } from '@turnkey/react-wallet-kit';
import { type WalletClient } from 'viem';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { SigningStargateClient, GasPrice, defaultRegistryTypes } from '@cosmjs/stargate';
import { Registry } from '@cosmjs/proto-signing';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';
import { TurnkeyDirectWallet } from '@turnkey/cosmjs';
import { Buffer } from 'buffer';

import {
  XION_RPC_URL,
  XION_REST_URL,
  NOBLE_RPC_URL,
  BASE_RPC_URL,
  COINFLOW_API,
  COINFLOW_BASE_URL,
  NOBLE_CONFIG,
  BASE_CONFIG,
  BASE_USDC_ADDRESS,
} from '@/config/api';
import { COINFLOW_MERCHANT_ID } from '@/utils/coinflowApi';
import { convertXionToNoble } from '@/utils/addressConversion';

import { burnUSDCOnNoble, formatUSDCAmount } from '@/utils/cctpNoble';
import { getAttestationSignature, normalizeAttestation, normalizeMessageBytes } from '@/utils/cctp';
import { mintUSDCOnBaseWithTurnkey, getBaseUSDCBalance, formatAddressForCCTP } from '@/utils/cctpBase';
import { createTurnkeyBaseClient, deriveBaseAddress } from '@/utils/turnkeyBase';
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
  baseMint?: string;
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

  // Base wallet client
  const [baseWalletClient, setBaseWalletClient] = useState<WalletClient | null>(null);

  // Account state
  const [xionAddress, setXionAddress] = useState<string>('');
  const [nobleAddress, setNobleAddress] = useState<string>('');
  const [baseAddress, setBaseAddress] = useState<string>('');

  // Balance state
  const [xionUsdcBalance, setXionUsdcBalance] = useState<string>('0');
  const [nobleUsdcBalance, setNobleUsdcBalance] = useState<string>('0');
  const [baseUsdcBalance, setBaseUsdcBalance] = useState<number>(0);

  // CCTP flow state
  const [cctpStep, setCctpStep] = useState<CCTPStep>('idle');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [txHashes, setTxHashes] = useState<TxHashes>({});
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [nobleToXionAmount, setNobleToXionAmount] = useState<string>('');
  const [nobleToBaseAmount, setNobleToBaseAmount] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [withdrawerDetails, setWithdrawerDetails] = useState<any>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalTxHash, setWithdrawalTxHash] = useState<string>('');
  const [selectedSpeed, setSelectedSpeed] = useState<'standard' | 'same_day' | 'asap'>('standard');
  const [quote, setQuote] = useState<any>(null);
  const [gettingQuote, setGettingQuote] = useState(false);

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

  // Initialize Xion, Noble, and Polygon signing clients
  useEffect(() => {
    const initSigningClients = async () => {
      if (!httpClient || !firstWallet?.accounts?.[0]) {
        setXionSigningClient(null);
        setNobleSigningClient(null);
        setBaseWalletClient(null);
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
        console.log('   Total wallets:', Array.isArray(wallets) ? wallets.length : 1);

        const allWallets = Array.isArray(wallets) ? wallets : [wallets];
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
            client: httpClient as any,
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

        // Initialize Base wallet with Turnkey using the Ethereum account
        try {
          console.log('🔧 Initializing Base wallet...');
          const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
          const baseClient = await createTurnkeyBaseClient(
            { apiClient: () => httpClient } as any,
            actualOrgId,
            ethereumAccount.walletAccountId, // Use the wallet account ID
            ethereumAccount.address, // Ethereum address
            network as 'mainnet' | 'sepolia'
          );

          setBaseAddress(ethereumAccount.address);
          setBaseWalletClient(baseClient);
          console.log('✅ Base wallet client created');
        } catch (error) {
          console.error('❌ Failed to create Base wallet:', error);
          throw error; // Re-throw since we expect this to work now
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
        setBaseWalletClient(null);
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

  // Fetch Base USDC balance
  useEffect(() => {
    const fetchBaseBalance = async () => {
      if (!baseAddress) return;

      try {
        const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
        const balance = await getBaseUSDCBalance(baseAddress, network as 'mainnet' | 'sepolia');
        setBaseUsdcBalance(balance);
      } catch (error) {
        console.error('Error fetching Base balance:', error);
      }
    };

    fetchBaseBalance();
    const interval = setInterval(fetchBaseBalance, 10000);
    return () => clearInterval(interval);
  }, [baseAddress]);

  // CCTP Transfer Handler
  const handleCCTPTransfer = async () => {
    console.log('🚀 Starting CCTP transfer...');
    console.log('   Addresses:', { xionAddress, nobleAddress, baseAddress });
    console.log('   Clients:', {
      xionSigning: !!xionSigningClient,
      nobleSigning: !!nobleSigningClient,
      baseWalletClient: !!baseWalletClient,
      xionQuery: !!xionQueryClient,
      nobleQuery: !!nobleQueryClient
    });

    if (!xionAddress || !nobleAddress || !baseAddress) {
      setError('Please connect Turnkey wallet (Xion, Noble, and Base addresses required)');
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

      // Format Base address for CCTP (pad to 32 bytes)
      const baseAddressBytes = formatAddressForCCTP(baseAddress);
      const baseAddressHex = '0x' + Buffer.from(baseAddressBytes).toString('hex');

      console.log('🎯 Base CCTP destination:', {
        wallet: baseAddress,
        addressBytes: baseAddressHex,
        domain: BASE_CONFIG.CCTP_DOMAIN
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

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient!,
        nobleAddress,
        burnAmountFromNoble.toString(),
        BASE_CONFIG.CCTP_DOMAIN, // Domain 6 for Base
        baseAddressHex, // Base address (padded to 32 bytes)
        undefined // No relayer needed - we'll mint manually
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

      // Step 4: Mint USDC on Base
      setCctpStep('mint');
      setStatusMessage('Minting USDC on Base...');

      if (!baseWalletClient) {
        throw new Error('Base wallet client not initialized');
      }

      const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
      const mintTxHash = await mintUSDCOnBaseWithTurnkey(
        baseWalletClient,
        new Uint8Array(Buffer.from(messageHex.slice(2), 'hex')),
        attestationHex,
        network as 'mainnet' | 'sepolia'
      );

      setTxHashes(prev => ({ ...prev, baseMint: mintTxHash }));

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
        memo: 'CCTP transfer to Base',
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

  // CCTP Burn Noble → Base (skip Xion step)
  const burnNobleToBase = async (inputAmount?: string) => {
    if (!nobleAddress || !baseAddress || !nobleSigningClient || !baseWalletClient) {
      setError('Noble or Base signing client not available');
      return;
    }

    setLoading(true);
    setError('');
    setTxHashes({});

    try {
      // Step 1: Burn USDC on Noble
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      // Format Base address for CCTP (pad to 32 bytes)
      const baseAddressBytes = formatAddressForCCTP(baseAddress);
      const baseAddressHex = '0x' + Buffer.from(baseAddressBytes).toString('hex');

      console.log('🎯 Base CCTP destination:', {
        wallet: baseAddress,
        addressBytes: baseAddressHex,
        domain: BASE_CONFIG.CCTP_DOMAIN
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

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient,
        nobleAddress,
        burnAmountString,
        BASE_CONFIG.CCTP_DOMAIN, // Domain 6 for Base
        baseAddressHex, // Base address (padded to 32 bytes)
        undefined // No relayer - we'll mint manually
      );
      setTxHashes({ nobleBurn: burnResult.transactionHash });

      // Step 2: Get Circle attestation
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

      // Step 3: Mint USDC on Base
      setCctpStep('mint');
      setStatusMessage('Minting USDC on Base...');

      const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
      const mintTxHash = await mintUSDCOnBaseWithTurnkey(
        baseWalletClient,
        new Uint8Array(Buffer.from(messageHex.slice(2), 'hex')),
        attestationHex,
        network as 'mainnet' | 'sepolia'
      );

      console.log('✅ Funds minted on Base! TX:', mintTxHash);

      // Success!
      setCctpStep('complete');
      setStatusMessage('CCTP Noble → Base complete!');

      setTimeout(() => {
        resetFlow();
      }, 5000);

    } catch (err: any) {
      console.error('Noble → Base CCTP error:', err);
      setError(err.message || 'CCTP transfer failed');
      setCctpStep('idle');
    } finally {
      setLoading(false);
    }
  };

  // Session key management
  const getStoredSessionKey = (walletAddress: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const key = localStorage.getItem(`coinflow-session-key-${walletAddress}`);
      // Filter out invalid values
      if (!key || key === 'undefined' || key === 'null') {
        return null;
      }
      return key;
    } catch (e) {
      console.error('Failed to get stored session key:', e);
      return null;
    }
  };

  const storeSessionKey = (walletAddress: string, key: string) => {
    if (typeof window === 'undefined') return;
    try {
      // Don't store invalid values
      if (!key || key === 'undefined' || key === 'null') {
        console.warn('Attempted to store invalid session key:', key);
        return;
      }
      localStorage.setItem(`coinflow-session-key-${walletAddress}`, key);
    } catch (e) {
      console.error('Failed to store session key:', e);
    }
  };

  const clearStoredSessionKey = (walletAddress: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`coinflow-session-key-${walletAddress}`);
      console.log('Cleared stored session key');
    } catch (e) {
      console.error('Failed to clear session key:', e);
    }
  };

  // Get or create session key
  const getSessionKey = async (): Promise<string> => {
    if (!baseAddress) throw new Error('Base address not available');

    // Clear state if it's invalid
    if (sessionKey === 'undefined' || sessionKey === 'null') {
      setSessionKey(null);
    }

    // Check for existing session key
    let currentKey = sessionKey || getStoredSessionKey(baseAddress);
    if (currentKey && currentKey !== 'undefined' && currentKey !== 'null') {
      console.log('Using existing session key:', currentKey.slice(0, 20) + '...');
      setSessionKey(currentKey);
      return currentKey;
    }

    // Clear any invalid stored keys
    if (baseAddress) {
      clearStoredSessionKey(baseAddress);
    }

    // Generate new session key
    console.log('Generating new session key for wallet:', baseAddress);
    const response = await fetch(`/api/coinflow/session-key?wallet=${encodeURIComponent(baseAddress)}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Session key API error:', errorData);
      throw new Error(errorData.error || 'Failed to get session key');
    }

    const data = await response.json();
    console.log('Session key API response:', data);

    const newKey = data.sessionKey || data.session_key || data.key;

    if (!newKey) {
      console.error('No session key in response. Full response:', data);
      throw new Error('Session key not found in response');
    }

    storeSessionKey(baseAddress, newKey);
    setSessionKey(newKey);
    console.log('✅ Session key generated:', newKey.slice(0, 20) + '...');

    return newKey;
  };

  // Load withdrawer details (bank accounts)
  const loadWithdrawerDetails = async () => {
    if (!baseAddress) {
      console.log('⚠️ Cannot load withdrawer details: no base address');
      return;
    }

    try {
      const key = await getSessionKey();
      console.log('📋 Loading withdrawer details...');
      console.log('   Wallet:', baseAddress);
      console.log('   Session key:', key.slice(0, 20) + '...');

      const url = `/api/coinflow/withdrawer?wallet=${encodeURIComponent(baseAddress)}&sessionKey=${encodeURIComponent(key)}`;
      console.log('   Fetching:', url);

      const response = await fetch(url);

      console.log('   Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Withdrawer API error:', errorData);
        throw new Error(`Failed to load withdrawer details: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      setWithdrawerDetails(data);
      console.log('✅ Withdrawer details loaded:', data);

      // Auto-select first bank account if available
      if (data.withdrawer?.bankAccounts?.length > 0) {
        setSelectedBankAccount(data.withdrawer.bankAccounts[0].token);
        console.log('✅ Auto-selected bank account:', data.withdrawer.bankAccounts[0].name);
      } else {
        console.log('⚠️ No bank accounts found in withdrawer details');
      }
    } catch (err: any) {
      console.error('❌ Failed to load withdrawer details:', err);
      console.error('   Error message:', err.message);
      // Don't set error state - they might just not have completed KYC yet
    }
  };

  // Load withdrawer details when baseAddress changes and after a delay (to allow session key to load)
  useEffect(() => {
    if (baseAddress) {
      console.log('🔄 Base address detected, will load withdrawer details...');
      // Add a small delay to ensure session key is available
      const timer = setTimeout(() => {
        loadWithdrawerDetails();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [baseAddress]);

  // Get withdrawal quote from Coinflow
  const getQuote = async (amount: string) => {
    if (!amount || !baseAddress) return;

    try {
      setGettingQuote(true);
      const key = await getSessionKey();

      const params = new URLSearchParams({
        amount: amount,
        token: BASE_USDC_ADDRESS,
        wallet: baseAddress,
        merchantId: COINFLOW_MERCHANT_ID(),
        usePermit: 'false'
      });

      const response = await fetch(`https://api${process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet' ? '' : '-sandbox'}.coinflow.cash/api/withdraw/quote?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-coinflow-auth-session-key': key,
          'x-coinflow-auth-blockchain': 'base'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get quote');
      }

      const quoteData = await response.json();
      setQuote(quoteData);
      console.log('💰 Withdrawal quote:', quoteData);
    } catch (error) {
      console.error('Error getting quote:', error);
      setQuote(null);
    } finally {
      setGettingQuote(false);
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    if (!baseAddress || !baseWalletClient || !withdrawAmount || !selectedBankAccount) {
      setError('Missing required withdrawal parameters');
      return;
    }

    setWithdrawing(true);
    setError('');
    setWithdrawalTxHash('');

    try {
      const key = await getSessionKey();

      // Step 1: Get withdrawal transaction details from Coinflow
      setStatusMessage('Getting withdrawal details from Coinflow...');
      console.log('📤 Step 1: Getting withdrawal transaction details');

      const txResponse = await fetch('/api/coinflow/withdraw-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: baseAddress,
          sessionKey: key,
          bankAccountToken: selectedBankAccount,
          amount: withdrawAmount,
          speed: selectedSpeed
        })
      });

      if (!txResponse.ok) {
        const error = await txResponse.json();
        throw new Error(error.error || 'Failed to get withdrawal transaction details');
      }

      const txData = await txResponse.json();
      console.log('✅ Withdrawal transaction details:', txData);

      // Step 2: Execute USDC transfer on Base
      setStatusMessage('Sending USDC transaction on Base...');
      console.log('📤 Step 2: Executing USDC transfer on Base');
      console.log('   USDC Contract:', BASE_USDC_ADDRESS);
      console.log('   To:', txData.address);
      console.log('   Amount (in smallest unit):', txData.amount);

      // Transfer USDC using ERC-20 transfer method
      const hash = await baseWalletClient.writeContract({
        address: BASE_USDC_ADDRESS as `0x${string}`,
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
          }
        ],
        functionName: 'transfer',
        args: [txData.address as `0x${string}`, BigInt(txData.amount)],
        chain: baseWalletClient.chain,
        account: baseWalletClient.account!,
      });

      console.log('✅ USDC transfer transaction sent:', hash);
      setWithdrawalTxHash(hash);

      // Step 3: Submit transaction hash to Coinflow
      setStatusMessage('Submitting transaction to Coinflow...');
      console.log('📤 Step 3: Submitting transaction hash to Coinflow');

      const submitResponse = await fetch('/api/coinflow/submit-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: baseAddress,
          sessionKey: key,
          hash
        })
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json();
        throw new Error(error.error || 'Failed to submit transaction hash');
      }

      const submitData = await submitResponse.json();
      console.log('✅ Transaction hash submitted:', submitData);

      // Success!
      setStatusMessage('✅ Withdrawal initiated successfully! Funds will be in your bank account within 1-3 business days.');
      setWithdrawAmount('');

      // Refresh balance
      setTimeout(() => {
        setStatusMessage('');
      }, 10000);

    } catch (err: any) {
      console.error('❌ Withdrawal error:', err);
      setError(err.message || 'Withdrawal failed');
      setStatusMessage('');
    } finally {
      setWithdrawing(false);
    }
  };

  // Handle gasless withdrawal using EIP-712 permit signing
  const handleWithdrawGasless = async () => {
    if (!baseAddress || !baseWalletClient || !withdrawAmount || !selectedBankAccount) {
      setError('Missing required withdrawal parameters');
      return;
    }

    setWithdrawing(true);
    setError('');
    setWithdrawalTxHash('');

    try {
      const key = await getSessionKey();

      // Step 1: Get EIP-712 permit message from Coinflow
      setStatusMessage('Getting permit message from Coinflow...');
      console.log('📤 Step 1: Getting EIP-712 permit message');

      const messageResponse = await fetch('/api/coinflow/evm-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: baseAddress,
          sessionKey: key,
          bankAccountToken: selectedBankAccount,
          amount: withdrawAmount,
          speed: selectedSpeed
        })
      });

      if (!messageResponse.ok) {
        const error = await messageResponse.json();
        throw new Error(error.error || 'Failed to get EIP-712 message');
      }

      const messageData = await messageResponse.json();
      console.log('✅ EIP-712 message received:', messageData);

      // Step 2: Sign the EIP-712 message with Turnkey wallet
      setStatusMessage('Please sign the permit message...');
      console.log('📤 Step 2: Signing EIP-712 message with Turnkey');

      // The message should be in EIP-712 typed data format
      const signature = await baseWalletClient.signTypedData({
        account: baseWalletClient.account!,
        domain: messageData.domain,
        types: messageData.types,
        primaryType: messageData.primaryType,
        message: messageData.message,
      });

      console.log('✅ Message signed:', signature);

      // Step 3: Submit the signed permit to Coinflow for gasless withdrawal
      setStatusMessage('Submitting gasless transaction to Coinflow...');
      console.log('📤 Step 3: Submitting gasless transaction');

      const submitResponse = await fetch('/api/coinflow/gasless-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: baseAddress,
          sessionKey: key,
          signature,
          message: messageData
        })
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json();
        throw new Error(error.error || 'Failed to submit gasless transaction');
      }

      const submitData = await submitResponse.json();
      console.log('✅ Gasless transaction submitted:', submitData);

      // The gasless transaction should return a transaction hash
      if (submitData.transactionHash || submitData.hash) {
        setWithdrawalTxHash(submitData.transactionHash || submitData.hash);
      }

      // Success!
      setStatusMessage('✅ Gasless withdrawal initiated successfully! No gas fees required. Funds will be in your bank account within 1-3 business days.');
      setWithdrawAmount('');
      setQuote(null);

      // Refresh balance
      setTimeout(() => {
        setStatusMessage('');
      }, 10000);

    } catch (err: any) {
      console.error('❌ Gasless withdrawal error:', err);
      setError(err.message || 'Gasless withdrawal failed');
      setStatusMessage('');
    } finally {
      setWithdrawing(false);
    }
  };

  // Redirect to Coinflow for bank account linking
  const handleBankAccountLink = async () => {
    if (!baseAddress) {
      setError('Base address not available');
      return;
    }

    try {
      const key = await getSessionKey();
      const baseUrl = `${COINFLOW_BASE_URL}/base/withdraw/${COINFLOW_MERCHANT_ID()}`;
      const url = new URL(baseUrl);
      url.searchParams.set('sessionKey', key);
      url.searchParams.set('bankAccountLinkRedirect', window.location.origin);

      console.log('Redirecting to Coinflow for bank account linking:', url.toString());
      window.location.href = url.toString();
    } catch (err: any) {
      console.error('Failed to initiate bank account linking:', err);
      setError(err.message || 'Failed to initiate bank account linking');
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
          Xion → Base CCTP
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

          {/* Base - derived from Turnkey */}
          {baseAddress && (
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700">Base (Turnkey)</div>
              <div className="text-xs text-gray-600 mt-1 break-all font-mono">
                {baseAddress}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(baseAddress);
                  setStatusMessage('Base address copied!');
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
        {(xionAddress || baseAddress) && (
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
                      {/* CCTP to Base */}
                      <div>
                        <input
                          type="number"
                          value={nobleToBaseAmount}
                          onChange={(e) => setNobleToBaseAmount(e.target.value)}
                          placeholder="Amount (or leave empty for all)"
                          disabled={loading || !baseAddress}
                          className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1"
                        />
                        <button
                          onClick={() => burnNobleToBase(nobleToBaseAmount)}
                          disabled={loading || !baseAddress}
                          className="w-full text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1 px-2 rounded"
                        >
                          → CCTP to Base
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {baseAddress && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Base USDC</div>
                  <div className="text-2xl font-bold">${baseUsdcBalance.toFixed(2)}</div>
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
                {txHashes.baseMint && (
                  <div className="break-all">
                    <span className="font-medium">Mint:</span> {txHashes.baseMint}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleCCTPTransfer}
                disabled={loading || cctpStep !== 'idle' || !xionAddress || !baseAddress}
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

        {/* Coinflow Withdrawal Section */}
        {baseAddress && baseUsdcBalance > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">Withdraw to Bank Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              {cctpStep === 'complete' && 'USDC has been successfully bridged to Base via CCTP!'}
              {cctpStep !== 'complete' && `You have $${baseUsdcBalance.toFixed(2)} USDC on Base.`}
            </p>

            {/* Show bank accounts if available */}
            {withdrawerDetails?.withdrawer?.bankAccounts?.length > 0 ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">Your Bank Accounts</h3>
                  <button
                    onClick={loadWithdrawerDetails}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Bank Account
                  </label>
                  <select
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {withdrawerDetails.withdrawer.bankAccounts.map((account: any) => (
                      <option key={account.token} value={account.token}>
                        {account.name} - {account.mask}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setWithdrawAmount(value);
                      if (value && parseFloat(value) > 0) {
                        await getQuote(value);
                      } else {
                        setQuote(null);
                      }
                    }}
                    max={baseUsdcBalance}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available: ${baseUsdcBalance.toFixed(2)} USDC
                  </p>
                </div>

                {gettingQuote && (
                  <div className="mb-4 text-sm text-gray-500">
                    Getting quote...
                  </div>
                )}

                {quote && (
                  <div className="mb-4 space-y-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">Select withdrawal speed:</div>

                    {/* Standard ACH */}
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedSpeed === 'standard'
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
                          : 'hover:bg-gray-50 border-gray-300'
                      }`}
                      onClick={() => setSelectedSpeed('standard')}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">Standard ACH (2-3 business days)</span>
                        <span className="text-green-600 font-medium">
                          ${(quote.standard.finalSettlement.cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Fee: ${(quote.standard.fee.cents / 100).toFixed(2)}
                      </div>
                    </div>

                    {/* ASAP */}
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedSpeed === 'asap'
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
                          : 'hover:bg-gray-50 border-gray-300'
                      }`}
                      onClick={() => setSelectedSpeed('asap')}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">ASAP (Minutes)</span>
                        <span className="text-green-600 font-medium">
                          ${(quote.asap.finalSettlement.cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Fee: ${(quote.asap.fee.cents / 100).toFixed(2)}
                      </div>
                    </div>

                    {/* Same Day ACH */}
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedSpeed === 'same_day'
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
                          : 'hover:bg-gray-50 border-gray-300'
                      }`}
                      onClick={() => setSelectedSpeed('same_day')}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">Same Day ACH</span>
                        <span className="text-green-600 font-medium">
                          ${(quote.same_day.finalSettlement.cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Fee: ${(quote.same_day.fee.cents / 100).toFixed(2)}
                      </div>
                    </div>

                    {quote.gasFees?.gasFees?.cents > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        Gas fees: ${(quote.gasFees.gasFees.cents / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > baseUsdcBalance}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {withdrawing ? 'Processing...' : `Withdraw (With Gas)`}
                  </button>
                  <button
                    onClick={handleWithdrawGasless}
                    disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > baseUsdcBalance}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    {withdrawing ? 'Processing...' : `Gasless Withdraw ⚡`}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-4 text-center">
                  💡 Gasless withdrawal uses EIP-712 permit signing - no Base gas fees required!
                </p>

                {withdrawalTxHash && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-800 break-all">
                      <strong>Transaction Hash:</strong><br />
                      {withdrawalTxHash}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleBankAccountLink}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  + Add Another Bank Account
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={handleBankAccountLink}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors mb-4"
                >
                  Link Bank Account & Withdraw
                </button>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>First-time users:</strong> You'll be redirected to Coinflow to:
                    <br />1. Verify your email
                    <br />2. Complete KYC verification (identity check)
                    <br />3. Link your bank account (ACH for US, IBAN for EU, etc.)
                    <br />4. Set up and complete your withdrawal
                    <br />
                    <br />After linking your bank, you'll be returned to this page.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
