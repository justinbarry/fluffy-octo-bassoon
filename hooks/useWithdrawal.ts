import { useState } from 'react';
import { type WalletClient } from 'viem';
import { destinations, coinflow } from '@/config';
import { COINFLOW_MERCHANT_ID } from '@/utils/coinflowApi';

type WithdrawalSpeed = 'standard' | 'same_day' | 'asap';

interface WithdrawalReturn {
  withdrawAmount: string;
  withdrawing: boolean;
  withdrawalTxHash: string;
  selectedBankAccount: string;
  selectedSpeed: WithdrawalSpeed;
  quote: any;
  gettingQuote: boolean;
  error: string;
  statusMessage: string;
  setWithdrawAmount: (amount: string) => void;
  setSelectedBankAccount: (token: string) => void;
  setSelectedSpeed: (speed: WithdrawalSpeed) => void;
  getQuote: (amount: string) => Promise<void>;
  handleWithdraw: () => Promise<void>;
  handleWithdrawGasless: () => Promise<void>;
  handleBankAccountLink: () => Promise<void>;
  setQuote: (quote: any) => void;
}

export function useWithdrawal(
  baseAddress: string,
  baseWalletClient: WalletClient | null,
  getSessionKey: () => Promise<string>
): WithdrawalReturn {
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalTxHash, setWithdrawalTxHash] = useState<string>('');
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [selectedSpeed, setSelectedSpeed] = useState<WithdrawalSpeed>('standard');
  const [quote, setQuote] = useState<any>(null);
  const [gettingQuote, setGettingQuote] = useState(false);
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Get withdrawal quote from Coinflow
  const getQuote = async (amount: string) => {
    if (!amount || !baseAddress) return;

    try {
      setGettingQuote(true);
      const key = await getSessionKey();

      const params = new URLSearchParams({
        amount: amount,
        token: destinations.base.usdcAddress,
        wallet: baseAddress,
        merchantId: COINFLOW_MERCHANT_ID(),
        usePermit: 'false'
      });

      const response = await fetch(
        `https://api${process.env.NEXT_PUBLIC_COINFLOW_ENV === 'mainnet' ? '' : '-sandbox'}.coinflow.cash/api/withdraw/quote?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-coinflow-auth-session-key': key,
            'x-coinflow-auth-blockchain': 'base'
          }
        }
      );

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

  // Handle regular withdrawal (with gas)
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

      setStatusMessage('Getting withdrawal details from Coinflow...');
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

      // Parse the transaction from Coinflow's response
      const rawTx = txData.transactions?.[0];
      if (!rawTx) {
        throw new Error('Coinflow did not return a Base transaction to execute.');
      }

      const baseTx = typeof rawTx === 'string' ? JSON.parse(rawTx) : rawTx;

      if (!baseTx?.to) {
        throw new Error('Invalid Base transaction returned from Coinflow. Missing recipient.');
      }

      console.log('📤 Parsed Base transaction:', {
        to: baseTx.to,
        value: baseTx.value,
        data: baseTx.data,
        gas: baseTx.gas,
      });

      setStatusMessage('Sending USDC transaction on Base...');

      // Helper to safely convert to bigint
      const toBigIntSafe = (value: any): bigint | undefined => {
        if (value === undefined || value === null) return undefined;
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number') return BigInt(Math.trunc(value));
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return undefined;
          return BigInt(trimmed);
        }
        return undefined;
      };

      const toNumberSafe = (value: any): number | undefined => {
        if (value === undefined || value === null) return undefined;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return parseInt(value);
        if (typeof value === 'bigint') return Number(value);
        return undefined;
      };

      const ensureHex = (value: string) =>
        value.startsWith('0x') ? (value as `0x${string}`) : (`0x${value}` as `0x${string}`);

      // Build transaction parameters (EIP-1559 vs Legacy)
      const txParams: any = {
        to: ensureHex(baseTx.to),
        data: baseTx.data ? ensureHex(baseTx.data) : undefined,
        value: toBigIntSafe(baseTx.value),
        gas: toBigIntSafe(baseTx.gas),
        nonce: toNumberSafe(baseTx.nonce),
        chain: baseWalletClient.chain,
      };

      // Use EIP-1559 if maxFeePerGas is provided, otherwise use legacy gasPrice
      if (baseTx.maxFeePerGas) {
        txParams.maxFeePerGas = toBigIntSafe(baseTx.maxFeePerGas);
        txParams.maxPriorityFeePerGas = toBigIntSafe(baseTx.maxPriorityFeePerGas);
      } else if (baseTx.gasPrice) {
        txParams.gasPrice = toBigIntSafe(baseTx.gasPrice);
      }

      const hash = await baseWalletClient.sendTransaction(txParams);

      setWithdrawalTxHash(hash);

      setStatusMessage('Submitting transaction to Coinflow...');
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

      setStatusMessage('✅ Withdrawal initiated successfully! Funds will be in your bank account within 1-3 business days.');
      setWithdrawAmount('');

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

      setStatusMessage('Getting permit message from Coinflow...');
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

      setStatusMessage('Please sign the permit message...');
      const signature = await baseWalletClient.signTypedData({
        account: baseWalletClient.account!,
        domain: messageData.domain,
        types: messageData.types,
        primaryType: messageData.primaryType,
        message: messageData.message,
      });

      setStatusMessage('Submitting gasless transaction to Coinflow...');
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

      if (submitData.transactionHash || submitData.hash) {
        setWithdrawalTxHash(submitData.transactionHash || submitData.hash);
      }

      setStatusMessage('✅ Gasless withdrawal initiated successfully! No gas fees required. Funds will be in your bank account within 1-3 business days.');
      setWithdrawAmount('');
      setQuote(null);

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
      const baseUrl = `${coinflow.baseUrl}/base/withdraw/${COINFLOW_MERCHANT_ID()}`;
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

  return {
    withdrawAmount,
    withdrawing,
    withdrawalTxHash,
    selectedBankAccount,
    selectedSpeed,
    quote,
    gettingQuote,
    error,
    statusMessage,
    setWithdrawAmount,
    setSelectedBankAccount,
    setSelectedSpeed,
    getQuote,
    handleWithdraw,
    handleWithdrawGasless,
    handleBankAccountLink,
    setQuote,
  };
}
