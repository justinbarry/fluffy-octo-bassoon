import { useState } from 'react';
import { TurnkeySigner } from '@turnkey/ethers';
import { destinations, coinflow } from '@/config';
import { COINFLOW_MERCHANT_ID } from '@/utils/coinflowApi';
import { signEIP712WithTurnkey, parseEIP712TypedData } from '@/utils/turnkeyEIP712';

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
  baseSigner: TurnkeySigner | null,
  getSessionKey: () => Promise<string>,
  turnkeyClient?: any,
  turnkeyOrganizationId?: string
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
    if (!baseAddress || !baseSigner || !withdrawAmount || !selectedBankAccount) {
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

      // Parse ALL transactions from Coinflow's response (usually 2: approval + withdrawal)
      const transactions = txData.transactions || [];
      if (transactions.length === 0) {
        throw new Error('Coinflow did not return any transactions to execute.');
      }

      console.log(`📤 Processing ${transactions.length} transaction(s) from Coinflow`);

      // Execute all transactions sequentially using ethers
      const hashes: string[] = [];
      for (let i = 0; i < transactions.length; i++) {
        const rawTx = transactions[i];
        const baseTx = typeof rawTx === 'string' ? JSON.parse(rawTx) : rawTx;

        if (!baseTx?.to) {
          throw new Error(`Transaction ${i + 1} is missing recipient address`);
        }

        console.log(`📤 Sending transaction ${i + 1}/${transactions.length}:`, {
          to: baseTx.to,
          value: baseTx.value,
          data: baseTx.data?.slice(0, 20) + '...',
          gas: baseTx.gas || baseTx.gasLimit,
        });

        setStatusMessage(`Sending transaction ${i + 1}/${transactions.length} on Base...`);

        // Build ethers transaction request
        const txRequest: any = {
          to: baseTx.to,
          data: baseTx.data || '0x',
          value: baseTx.value || 0,
          gasLimit: baseTx.gas || baseTx.gasLimit,
        };

        // Add nonce if provided
        if (baseTx.nonce !== undefined && baseTx.nonce !== null) {
          txRequest.nonce = parseInt(baseTx.nonce);
        }

        // Use EIP-1559 if maxFeePerGas is provided, otherwise use legacy gasPrice
        if (baseTx.maxFeePerGas) {
          txRequest.maxFeePerGas = baseTx.maxFeePerGas;
          txRequest.maxPriorityFeePerGas = baseTx.maxPriorityFeePerGas;
        } else if (baseTx.gasPrice) {
          txRequest.gasPrice = baseTx.gasPrice;
        }

        const tx = await baseSigner.sendTransaction(txRequest);
        console.log(`✅ Transaction ${i + 1} sent:`, tx.hash);
        hashes.push(tx.hash);

        // Wait for transaction to be mined before sending next one
        if (i < transactions.length - 1) {
          console.log(`⏳ Waiting for transaction ${i + 1} to confirm...`);
          await tx.wait();
          console.log(`✅ Transaction ${i + 1} confirmed`);
        }
      }

      const finalHash = hashes[hashes.length - 1]; // Use last transaction hash as the main one
      setWithdrawalTxHash(finalHash);

      setStatusMessage('Submitting transaction to Coinflow...');
      const submitResponse = await fetch('/api/coinflow/submit-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: baseAddress,
          sessionKey: key,
          hash: finalHash
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
    if (!baseAddress || !baseSigner || !withdrawAmount || !selectedBankAccount) {
      setError('Missing required withdrawal parameters');
      return;
    }

    if (!turnkeyClient || !turnkeyOrganizationId) {
      setError('Turnkey client not available for gasless signing');
      return;
    }

    console.log('🔐 Using Turnkey Organization ID for signing:', turnkeyOrganizationId);

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

      const responseData = await messageResponse.json();
      console.log('✅ EIP-712 response received:', responseData);

      // Parse and validate the EIP-712 typed data
      const typedData = parseEIP712TypedData(responseData.message);

      console.log('📝 Parsed EIP-712 typed data:', {
        domain: typedData.domain,
        types: Object.keys(typedData.types),
        primaryType: typedData.primaryType,
      });

      setStatusMessage('Please sign the permit message...');

      // Sign the EIP-712 typed data using Turnkey's Raw Digest Method
      const signature = await signEIP712WithTurnkey(
        turnkeyClient,
        turnkeyOrganizationId,
        baseAddress, // Using baseAddress as the signWith parameter
        typedData
      );

      console.log('✅ EIP-712 signature obtained:', signature.slice(0, 20) + '...');

      setStatusMessage('Submitting gasless transaction to Coinflow...');
      console.log('📤 Step 3: Submitting gasless transaction with:', {
        amount: withdrawAmount,
        speed: selectedSpeed,
        bankAccount: selectedBankAccount,
        hasSignature: !!signature,
      });

      const submitResponse = await fetch('/api/coinflow/gasless-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: baseAddress,
          sessionKey: key,
          signature,
          message: responseData.message, // Send the original stringified message
          amount: withdrawAmount,
          speed: selectedSpeed,
          bankAccountToken: selectedBankAccount
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
