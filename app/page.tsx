'use client';

import React, { useState, useEffect } from 'react';
import { useTurnkey } from '@turnkey/react-wallet-kit';

// Custom Hooks
import { useWalletClients } from '@/hooks/useWalletClients';
import { useBalances } from '@/hooks/useBalances';
import { useCCTPTransfer } from '@/hooks/useCCTPTransfer';
import { useCoinflowSession } from '@/hooks/useCoinflowSession';
import { useWithdrawal } from '@/hooks/useWithdrawal';

// Components
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { BalanceSection } from '@/components/wallet/BalanceSection';
import { CCTPBridgeForm } from '@/components/bridge/CCTPBridgeForm';
import { CoinflowWithdrawal } from '@/components/withdrawal/CoinflowWithdrawal';

export default function Home() {
  // Turnkey authentication
  const { authState, user, wallets, handleLogin, httpClient } = useTurnkey();

  const firstWallet = Array.isArray(wallets) ? wallets[0] : wallets;

  // Initialize wallet clients and addresses
  const {
    xionQueryClient,
    nobleQueryClient,
    xionSigningClient,
    nobleSigningClient,
    baseWalletClient,
    xionAddress,
    nobleAddress,
    baseAddress,
  } = useWalletClients(httpClient, firstWallet);

  // Fetch and poll balances
  const { xionUsdcBalance, nobleUsdcBalance, baseUsdcBalance } = useBalances(
    xionAddress,
    nobleAddress,
    baseAddress,
    xionQueryClient,
    nobleQueryClient
  );

  // CCTP transfer state and handlers
  const {
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
  } = useCCTPTransfer(
    xionAddress,
    nobleAddress,
    baseAddress,
    xionSigningClient,
    nobleSigningClient,
    baseWalletClient,
    nobleQueryClient
  );

  // Coinflow session management
  const { sessionKey, withdrawerDetails, getSessionKey, loadWithdrawerDetails } =
    useCoinflowSession(baseAddress);

  // Withdrawal state and handlers
  const {
    withdrawAmount,
    withdrawing,
    withdrawalTxHash,
    selectedBankAccount,
    selectedSpeed,
    quote,
    gettingQuote,
    error: withdrawalError,
    statusMessage: withdrawalStatus,
    setWithdrawAmount,
    setSelectedBankAccount,
    setSelectedSpeed,
    getQuote,
    handleWithdraw,
    handleWithdrawGasless,
    handleBankAccountLink,
    setQuote,
  } = useWithdrawal(
    baseAddress,
    baseWalletClient,
    getSessionKey
  );

  // UI state for Noble actions
  const [nobleToXionAmount, setNobleToXionAmount] = useState<string>('');
  const [nobleToBaseAmount, setNobleToBaseAmount] = useState<string>('');

  // Auto-select first bank account when withdrawer details are loaded
  useEffect(() => {
    if (withdrawerDetails?.withdrawer?.bankAccounts?.length > 0 && !selectedBankAccount) {
      const firstBankAccount = withdrawerDetails.withdrawer.bankAccounts[0].token;
      setSelectedBankAccount(firstBankAccount);
      console.log('✅ Auto-selected bank account:', withdrawerDetails.withdrawer.bankAccounts[0].name || firstBankAccount);
    }
  }, [withdrawerDetails, selectedBankAccount, setSelectedBankAccount]);

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
        <WalletConnect
          authState={authState}
          xionAddress={xionAddress}
          nobleAddress={nobleAddress}
          baseAddress={baseAddress}
          httpClient={httpClient}
          handleLogin={handleLogin}
          debugWhoAmI={debugWhoAmI}
          onCopyAddress={(address) => {
            navigator.clipboard.writeText(address);
            setStatusMessage('Base address copied!');
            setTimeout(() => setStatusMessage(''), 2000);
          }}
        />

        {/* Balances */}
        <BalanceSection
          xionAddress={xionAddress}
          nobleAddress={nobleAddress}
          baseAddress={baseAddress}
          xionUsdcBalance={xionUsdcBalance}
          nobleUsdcBalance={nobleUsdcBalance}
          baseUsdcBalance={baseUsdcBalance}
          nobleToXionAmount={nobleToXionAmount}
          nobleToBaseAmount={nobleToBaseAmount}
          loading={loading}
          onNobleToXionAmountChange={setNobleToXionAmount}
          onNobleToBaseAmountChange={setNobleToBaseAmount}
          onTransferToXion={transferNobleToXion}
          onTransferToBase={burnNobleToBase}
        />

        {/* CCTP Transfer Section */}
        <CCTPBridgeForm
          transferAmount={transferAmount}
          statusMessage={statusMessage}
          error={error}
          cctpStep={cctpStep}
          txHashes={txHashes}
          loading={loading}
          xionAddress={xionAddress}
          baseAddress={baseAddress}
          onTransferAmountChange={setTransferAmount}
          onSubmit={handleCCTPTransfer}
          onReset={resetFlow}
        />

        {/* Coinflow Withdrawal Section */}
        <CoinflowWithdrawal
          baseAddress={baseAddress}
          baseUsdcBalance={baseUsdcBalance}
          cctpStep={cctpStep}
          withdrawerDetails={withdrawerDetails}
          withdrawAmount={withdrawAmount}
          withdrawing={withdrawing}
          withdrawalTxHash={withdrawalTxHash}
          selectedBankAccount={selectedBankAccount}
          selectedSpeed={selectedSpeed}
          quote={quote}
          gettingQuote={gettingQuote}
          error={withdrawalError}
          statusMessage={withdrawalStatus}
          onWithdrawAmountChange={async (value) => {
            setWithdrawAmount(value);
            if (value && parseFloat(value) > 0) {
              await getQuote(value);
            } else {
              setQuote(null);
            }
          }}
          onBankAccountChange={setSelectedBankAccount}
          onSpeedChange={setSelectedSpeed}
          onWithdraw={handleWithdraw}
          onWithdrawGasless={handleWithdrawGasless}
          onBankAccountLink={handleBankAccountLink}
          onRefreshWithdrawer={loadWithdrawerDetails}
        />
      </div>
    </main>
  );
}
