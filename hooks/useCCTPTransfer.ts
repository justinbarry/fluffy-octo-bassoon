import { useState } from 'react';
import { TurnkeySigner } from '@turnkey/ethers';
import { SigningStargateClient } from '@cosmjs/stargate';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Buffer } from 'buffer';
import { sources, destinations } from '@/config';
import { burnUSDCOnNoble } from '@/utils/cctpNoble';
import { getAttestationSignature, normalizeAttestation, normalizeMessageBytes } from '@/utils/cctp';
import { mintUSDCOnBaseWithEthers, formatAddressForCCTP } from '@/utils/cctpBase';
import { buildIBCTransferMessage, buildIBCTransferMessageMicroUnits } from '@/utils/ibc';
import { formatAddressForCCTPHex } from '@/utils/conversions';
import {
  NOBLE_BURN_GAS_BUFFER,
  NOBLE_IBC_GAS_FEE,
  NOBLE_GAS_LIMIT,
  IBC_SETTLEMENT_WAIT_TIME,
  getNetworkEnvironment,
  SUCCESS_MESSAGE_DURATION
} from '@/utils/constants';

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

    const ibcMsg = buildIBCTransferMessage({
      senderAddress: xionAddress,
      receiverAddress: nobleAddress,
      amount,
      denom: sources.xion.usdcDenom,
      channel: sources.xion.ibcChannel,
      memo: 'CCTP transfer to Base'
    });

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
      await new Promise(resolve => setTimeout(resolve, IBC_SETTLEMENT_WAIT_TIME));

      // Query actual Noble balance after IBC transfer
      setStatusMessage('Checking Noble balance...');
      const nobleBalance = await nobleQueryClient!.getBalance(nobleAddress, 'uusdc');
      const nobleBalanceInMicroUnits = parseInt(nobleBalance.amount);

      // Step 2: Burn USDC on Noble
      setCctpStep('burn');
      setStatusMessage('Burning USDC on Noble via CCTP...');

      const baseAddressHex = formatAddressForCCTPHex(baseAddress);
      const burnAmountFromNoble = Math.floor(nobleBalanceInMicroUnits - NOBLE_BURN_GAS_BUFFER);

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

      const network = getNetworkEnvironment();
      const mintTxHash = await mintUSDCOnBaseWithEthers(
        baseSigner,
        new Uint8Array(Buffer.from(messageHex.slice(2), 'hex')),
        attestationHex,
        network
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

      let transferAmt: number;
      if (inputAmount && parseFloat(inputAmount) > 0) {
        const requestedAmount = Math.floor(parseFloat(inputAmount) * 1000000);
        if (requestedAmount + NOBLE_IBC_GAS_FEE > balanceInMicroUnits) {
          throw new Error('Insufficient balance for requested amount plus gas fees.');
        }
        transferAmt = requestedAmount;
      } else {
        transferAmt = balanceInMicroUnits - NOBLE_IBC_GAS_FEE;
      }

      if (transferAmt <= 0) {
        throw new Error('Insufficient balance. Need at least 0.025 USDC for gas fees.');
      }

      const ibcMsg = buildIBCTransferMessageMicroUnits({
        senderAddress: nobleAddress,
        receiverAddress: xionAddress,
        microUnits: transferAmt.toString(),
        denom: 'uusdc',
        channel: process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet' ? 'channel-0' : 'channel-0',
        memo: 'Return USDC to Xion'
      });

      const result = await nobleSigningClient.signAndBroadcast(
        nobleAddress,
        [ibcMsg],
        {
          amount: [{ denom: 'uusdc', amount: NOBLE_IBC_GAS_FEE.toString() }],
          gas: NOBLE_GAS_LIMIT
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
      }, SUCCESS_MESSAGE_DURATION);
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

      const baseAddressHex = formatAddressForCCTPHex(baseAddress);

      const freshNobleBalance = await nobleQueryClient!.getBalance(nobleAddress, 'uusdc');
      const balanceInMicroUnits = parseInt(freshNobleBalance.amount);

      let burnAmount: number;
      if (inputAmount && parseFloat(inputAmount) > 0) {
        const requestedAmount = Math.floor(parseFloat(inputAmount) * 1000000);
        if (requestedAmount + NOBLE_BURN_GAS_BUFFER > balanceInMicroUnits) {
          throw new Error('Insufficient balance for requested amount plus gas fees.');
        }
        burnAmount = requestedAmount;
      } else {
        burnAmount = balanceInMicroUnits - NOBLE_BURN_GAS_BUFFER;
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

      const network = getNetworkEnvironment();
      const mintTxHash = await mintUSDCOnBaseWithEthers(
        baseSigner,
        new Uint8Array(Buffer.from(messageHex.slice(2), 'hex')),
        attestationHex,
        network
      );

      console.log('✅ Funds minted on Base! TX:', mintTxHash);

      setCctpStep('complete');
      setStatusMessage('CCTP Noble → Base complete!');

      setTimeout(() => {
        resetFlow();
      }, SUCCESS_MESSAGE_DURATION);

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
