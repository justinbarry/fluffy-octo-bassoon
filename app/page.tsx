'use client';

import React, { useState, useEffect } from 'react';
import { useTurnkey, AuthState } from '@turnkey/react-wallet-kit';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey } from '@solana/web3.js';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { SigningStargateClient, GasPrice, defaultRegistryTypes } from '@cosmjs/stargate';
import { Registry } from '@cosmjs/proto-signing';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';
import { TurnkeyDirectWallet } from '@turnkey/cosmjs';
import { CoinflowWithdraw } from '@coinflowlabs/react';

import {
  XION_RPC_URL,
  XION_REST_URL,
  NOBLE_RPC_URL,
  COINFLOW_API,
  COINFLOW_MERCHANT_ID,
  COINFLOW_BASE_URL,
  NOBLE_CONFIG,
  SOLANA_CONFIG,
} from '@/config/api';

import { burnUSDCOnNoble, formatUSDCAmount } from '@/utils/cctpNoble';
import { getAttestationSignature, normalizeAttestation, normalizeMessageBytes } from '@/utils/cctp';
import { mintUSDCOnSolana, getSolanaUSDCBalance } from '@/utils/cctpSolana';
import { MsgDepositForBurn } from '@/proto/circle/cctp/v1/tx';

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

  // Solana wallet state
  const solanaWallet = useWallet();
  const { connection: solanaConnection } = useConnection();

  // Cosmos clients
  const [xionSigningClient, setXionSigningClient] = useState<SigningStargateClient | null>(null);
  const [nobleSigningClient, setNobleSigningClient] = useState<SigningStargateClient | null>(null);
  const [queryClient, setQueryClient] = useState<CosmWasmClient | null>(null);

  // Account state
  const [xionAddress, setXionAddress] = useState<string>('');
  const [nobleAddress, setNobleAddress] = useState<string>('');

  // Balance state
  const [xionUsdcBalance, setXionUsdcBalance] = useState<string>('0');
  const [solanaUsdcBalance, setSolanaUsdcBalance] = useState<number>(0);

  // CCTP flow state
  const [cctpStep, setCctpStep] = useState<CCTPStep>('idle');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [txHashes, setTxHashes] = useState<TxHashes>({});
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);

  const firstWallet = Array.isArray(wallets) ? wallets[0] : wallets;

  // Initialize Xion query client
  useEffect(() => {
    const initQueryClient = async () => {
      try {
        const client = await CosmWasmClient.connect(XION_RPC_URL);
        setQueryClient(client);
      } catch (error) {
        console.error('Failed to connect query client:', error);
      }
    };
    initQueryClient();
  }, []);

  // Initialize Xion and Noble signing clients
  useEffect(() => {
    const initSigningClients = async () => {
      if (!httpClient || !firstWallet?.accounts?.[0]) {
        setXionSigningClient(null);
        setNobleSigningClient(null);
        setXionAddress('');
        setNobleAddress('');
        return;
      }

      try {
        const walletAccount = firstWallet.accounts[0];

        // Initialize Xion wallet
        const xionWallet = await TurnkeyDirectWallet.init({
          config: {
            client: httpClient,
            organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '',
            signWith: walletAccount.address || '',
          },
          prefix: 'xion',
        });

        const accounts = await xionWallet.getAccounts();
        const xionAddr = accounts?.[0]?.address;
        if (xionAddr) {
          setXionAddress(xionAddr);
          // Convert to Noble address
          const { data } = fromBech32(xionAddr);
          setNobleAddress(toBech32('noble', data));
        }

        // Connect Xion client
        const xionClient = await SigningStargateClient.connectWithSigner(
          XION_RPC_URL,
          xionWallet,
          { gasPrice: GasPrice.fromString('0.001uxion') }
        );
        setXionSigningClient(xionClient);

        // Initialize Noble wallet
        const nobleWallet = await TurnkeyDirectWallet.init({
          config: {
            client: httpClient,
            organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '',
            signWith: walletAccount.address || '',
          },
          prefix: 'noble',
        });

        const nobleRegistry = new Registry([
          ...defaultRegistryTypes,
          [MsgDepositForBurn.typeUrl, MsgDepositForBurn as any],
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

        console.log('✅ Cosmos signing clients initialized');
      } catch (error) {
        console.error('Failed to initialize signing clients:', error);
        setXionSigningClient(null);
        setNobleSigningClient(null);
      }
    };

    initSigningClients();
  }, [httpClient, firstWallet?.accounts?.[0]?.address]);

  // Fetch Xion USDC balance
  useEffect(() => {
    const fetchXionBalance = async () => {
      if (!xionAddress || !queryClient) return;

      try {
        const balance = await queryClient.getBalance(xionAddress, USDC_DENOM);
        setXionUsdcBalance((parseInt(balance.amount) / 1000000).toFixed(2));
      } catch (error) {
        console.error('Error fetching Xion balance:', error);
      }
    };

    fetchXionBalance();
    const interval = setInterval(fetchXionBalance, 10000);
    return () => clearInterval(interval);
  }, [xionAddress, queryClient]);

  // Fetch Solana USDC balance
  useEffect(() => {
    const fetchSolanaBalance = async () => {
      if (!solanaWallet.publicKey || !solanaConnection) return;

      try {
        const balance = await getSolanaUSDCBalance(solanaConnection, solanaWallet.publicKey);
        setSolanaUsdcBalance(balance);
      } catch (error) {
        console.error('Error fetching Solana balance:', error);
      }
    };

    fetchSolanaBalance();
    const interval = setInterval(fetchSolanaBalance, 10000);
    return () => clearInterval(interval);
  }, [solanaWallet.publicKey, solanaConnection]);

  // CCTP Transfer Handler
  const handleCCTPTransfer = async () => {
    if (!xionAddress || !nobleAddress || !solanaWallet.publicKey) {
      setError('Please connect both Turnkey and Solana wallets');
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

      // Step 2: Burn USDC on Noble
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient!,
        nobleAddress,
        formatUSDCAmount(transferAmount),
        SOLANA_CONFIG.CCTP_DOMAIN, // Domain 5 for Solana
        '0x' + solanaWallet.publicKey.toBuffer().toString('hex')
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

      const mintResult = await mintUSDCOnSolana(
        solanaConnection,
        solanaWallet,
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
              onClick={() => authState !== AuthState.Authenticated && handleLogin()}
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

          {/* Solana */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Solana
            </label>
            <WalletMultiButton className="w-full" />
          </div>
        </div>

        {/* Balances */}
        {(xionAddress || solanaWallet.publicKey) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Balances</h2>
            <div className="grid grid-cols-2 gap-4">
              {xionAddress && (
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <div className="text-sm text-gray-600">Xion USDC</div>
                  <div className="text-2xl font-bold">${xionUsdcBalance}</div>
                </div>
              )}
              {solanaWallet.publicKey && (
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
                {txHashes.ibcTransfer && <div className="mb-1">IBC: {txHashes.ibcTransfer.slice(0, 16)}...</div>}
                {txHashes.nobleBurn && <div className="mb-1">Burn: {txHashes.nobleBurn.slice(0, 16)}...</div>}
                {txHashes.solanaMint && <div>Mint: {txHashes.solanaMint.slice(0, 16)}...</div>}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleCCTPTransfer}
                disabled={loading || cctpStep !== 'idle' || !xionAddress || !solanaWallet.publicKey}
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
        {cctpStep === 'complete' && solanaWallet.publicKey && solanaWallet.connected && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">Withdraw to Bank Account</h2>
            {/* @ts-ignore - Coinflow type mismatch with wallet adapter */}
            <CoinflowWithdraw
              wallet={solanaWallet as any}
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
