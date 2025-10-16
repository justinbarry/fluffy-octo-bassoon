'use client';

import React, { useMemo } from 'react';
import { TurnkeyProvider } from '@turnkey/react-wallet-kit';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SOLANA_RPC_URL } from '@/config/api';

// Import Solana wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  // Configure Solana wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const turnkeyOrgId = process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '';

  return (
    <TurnkeyProvider
      config={{
        organizationId: turnkeyOrgId,
      }}
    >
      <ConnectionProvider endpoint={SOLANA_RPC_URL}>
        <WalletProvider wallets={wallets} autoConnect={false}>
          <WalletModalProvider>
            {children}
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </TurnkeyProvider>
  );
}
