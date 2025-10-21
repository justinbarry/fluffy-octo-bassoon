import { useState } from 'react';
import { TurnkeySigner } from '@turnkey/ethers';
import { SigningStargateClient } from '@cosmjs/stargate';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';
import { Buffer } from 'buffer';
import { sources, bridge, destinations } from '@/config';
import { burnUSDCOnNoble } from '@/utils/cctpNoble';
import { getAttestationSignature, normalizeAttestation, normalizeMessageBytes } from '@/utils/cctp';
import { mintUSDCOnBaseWithEthers, formatAddressForCCTP } from '@/utils/cctpBase';

type CCTPStep = 'idle' | 'ibc' | 'burn' | 'attest' | 'mint' | 'complete';

interface TxHashes {
  ibcTransfer?: string;
  nobleBurn?: string;
  baseMint?: string;
}

interface CCTPTransferReturn {
  cctpStep: CCTPStep;
  transferAmount: string;
  txHashes: TxHashes;
  loading: boolean;
  error: string;
  statusMessage: string;
  setTransferAmount: (amount: string) => void;
  handleCCTPTransfer: () => Promise<void>;
  transferNobleToXion: (amount?: string) => Promise<void>;
  burnNobleToBase: (amount?: string) => Promise<void>;
  resetFlow: () => void;
  setStatusMessage: (message: string) => void;
}

export function useCCTPTransfer(
  xionAddress: string,
  nobleAddress: string,
  baseAddress: string,
  xionSigningClient: SigningStargateClient | null,
  nobleSigningClient: SigningStargateClient | null,
  baseSigner: TurnkeySigner | null,
  nobleQueryClient: CosmWasmClient | null
): CCTPTransferReturn {
  const [cctpStep, setCctpStep] = useState<CCTPStep>('idle');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [txHashes, setTxHashes] = useState<TxHashes>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // IBC Transfer from Xion to Noble
  const transferUSDCToNoble = async (amount: string): Promise<string> => {
    if (!xionAddress || !nobleAddress || !xionSigningClient) {
      throw new Error('Xion signing client not available');
    }

    const ibcMsg = {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: MsgTransfer.fromPartial({
        sourcePort: 'transfer',
        sourceChannel: sources.xion.ibcChannel,
        token: {
          denom: sources.xion.usdcDenom,
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

  // Main CCTP transfer handler (Xion → Noble → Base)
  const handleCCTPTransfer = async () => {
    console.log('🚀 Starting CCTP transfer...');

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

      // Step 2: Burn USDC on Noble
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      const baseAddressBytes = formatAddressForCCTP(baseAddress);
      const baseAddressHex = '0x' + Buffer.from(baseAddressBytes).toString('hex');

      const gasFeeBuffer = 40000; // 0.04 USDC
      const burnAmountFromNoble = Math.floor(nobleBalanceInMicroUnits - gasFeeBuffer);

      if (burnAmountFromNoble <= 0) {
        throw new Error('Insufficient Noble balance after IBC transfer. Need at least 0.04 USDC for gas.');
      }

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient!,
        nobleAddress,
        burnAmountFromNoble.toString(),
        destinations.base.cctpDomain,
        baseAddressHex,
        undefined
      );
      setTxHashes(prev => ({ ...prev, nobleBurn: burnResult.transactionHash }));

      // Step 3: Get Circle attestation
      setCctpStep('attest');
      setStatusMessage('Fetching attestation from Circle (this may take 2-3 minutes)...');

      const { attestation, message } = await getAttestationSignature(
        burnResult.transactionHash,
        240,
        5000
      );

      const attestationHex = normalizeAttestation(attestation);
      const messageHex = normalizeMessageBytes(burnResult.messageBytes || message);

      if (!attestationHex || !messageHex) {
        throw new Error('Failed to retrieve attestation or message bytes');
      }

      // Step 4: Mint USDC on Base
      setCctpStep('mint');
      setStatusMessage('Minting USDC on Base...');

      if (!baseSigner) {
        throw new Error('Base signer not initialized');
      }

      const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
      const mintTxHash = await mintUSDCOnBaseWithEthers(
        baseSigner,
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

      const freshNobleBalance = await nobleQueryClient.getBalance(nobleAddress, 'uusdc');
      const balanceInMicroUnits = parseInt(freshNobleBalance.amount);
      const gasFeeBuffer = 25000;

      let transferAmt: number;
      if (inputAmount && parseFloat(inputAmount) > 0) {
        const requestedAmount = Math.floor(parseFloat(inputAmount) * 1000000);
        if (requestedAmount + gasFeeBuffer > balanceInMicroUnits) {
          throw new Error('Insufficient balance for requested amount plus gas fees.');
        }
        transferAmt = requestedAmount;
      } else {
        transferAmt = balanceInMicroUnits - gasFeeBuffer;
      }

      if (transferAmt <= 0) {
        throw new Error('Insufficient balance. Need at least 0.025 USDC for gas fees.');
      }

      const ibcMsg = {
        typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
        value: MsgTransfer.fromPartial({
          sourcePort: 'transfer',
          sourceChannel: process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet' ? 'channel-0' : 'channel-0',
          token: {
            denom: 'uusdc',
            amount: transferAmt.toString(),
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

  // CCTP Burn Noble → Base
  const burnNobleToBase = async (inputAmount?: string) => {
    if (!nobleAddress || !baseAddress || !nobleSigningClient || !baseSigner) {
      setError('Noble or Base signing client not available');
      return;
    }

    setLoading(true);
    setError('');
    setTxHashes({});

    try {
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      const baseAddressBytes = formatAddressForCCTP(baseAddress);
      const baseAddressHex = '0x' + Buffer.from(baseAddressBytes).toString('hex');

      const freshNobleBalance = await nobleQueryClient!.getBalance(nobleAddress, 'uusdc');
      const balanceInMicroUnits = parseInt(freshNobleBalance.amount);
      const gasFeeBuffer = 40000;

      let burnAmount: number;
      if (inputAmount && parseFloat(inputAmount) > 0) {
        const requestedAmount = Math.floor(parseFloat(inputAmount) * 1000000);
        if (requestedAmount + gasFeeBuffer > balanceInMicroUnits) {
          throw new Error('Insufficient balance for requested amount plus gas fees.');
        }
        burnAmount = requestedAmount;
      } else {
        burnAmount = balanceInMicroUnits - gasFeeBuffer;
      }

      if (burnAmount <= 0) {
        throw new Error('Insufficient balance. Need at least 0.04 USDC for gas fees.');
      }

      const burnResult = await burnUSDCOnNoble(
        nobleSigningClient,
        nobleAddress,
        Math.floor(burnAmount).toString(),
        destinations.base.cctpDomain,
        baseAddressHex,
        undefined
      );
      setTxHashes({ nobleBurn: burnResult.transactionHash });

      setCctpStep('attest');
      setStatusMessage('Fetching attestation from Circle (this may take 2-3 minutes)...');

      const { attestation, message } = await getAttestationSignature(
        burnResult.transactionHash,
        240,
        5000
      );

      const attestationHex = normalizeAttestation(attestation);
      const messageHex = normalizeMessageBytes(burnResult.messageBytes || message);

      if (!attestationHex || !messageHex) {
        throw new Error('Failed to retrieve attestation or message bytes');
      }

      setCctpStep('mint');
      setStatusMessage('Minting USDC on Base...');

      const network = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' ? 'mainnet' : 'sepolia';
      const mintTxHash = await mintUSDCOnBaseWithEthers(
        baseSigner,
        new Uint8Array(Buffer.from(messageHex.slice(2), 'hex')),
        attestationHex,
        network as 'mainnet' | 'sepolia'
      );

      console.log('✅ Funds minted on Base! TX:', mintTxHash);

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

  const resetFlow = () => {
    setCctpStep('idle');
    setTxHashes({});
    setError('');
    setStatusMessage('');
    setTransferAmount('');
  };

  return {
    cctpStep,
    transferAmount,
    txHashes,
    loading,
    error,
    statusMessage,
    setTransferAmount,
    handleCCTPTransfer,
    transferNobleToXion,
    burnNobleToBase,
    resetFlow,
    setStatusMessage,
  };
}
