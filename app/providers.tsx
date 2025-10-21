'use client';

import React from 'react';
import { TurnkeyProvider, TurnkeyProviderConfig } from '@turnkey/react-wallet-kit';
import '@turnkey/react-wallet-kit/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  const turnkeyConfig: TurnkeyProviderConfig = {
    organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID!,
    authProxyConfigId: '5119dae0-9dd2-4b94-a7df-131c945f3afc',

    // Enable authentication methods
    auth: {
      // Create wallets for Cosmos chains (Xion, Noble) and EVM chains (Base)
      createSuborgParams: {
        emailOtpAuth: {
          userName: 'XION User',
          customWallet: {
            walletName: 'Multi-Chain Wallet',
            walletAccounts: [
                // Cosmos chain accounts (Xion, Noble)
                {
                    curve: "CURVE_SECP256K1",
                    pathFormat: "PATH_FORMAT_BIP32",
                    path: "m/44'/118'/0'/0/0",
                    addressFormat: "ADDRESS_FORMAT_UNCOMPRESSED",
                },
                {
                    curve: "CURVE_SECP256K1",
                    pathFormat: "PATH_FORMAT_BIP32",
                    path: "m/44'/118'/0'/0/0",
                    addressFormat: "ADDRESS_FORMAT_COSMOS",
                },
                // EVM chain accounts (Base, Polygon, etc.)
                {
                    curve: "CURVE_SECP256K1",
                    pathFormat: "PATH_FORMAT_BIP32",
                    path: "m/44'/60'/0'/0/0", // Ethereum derivation path
                    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                }
            ],
          },
        },
        passkeyAuth: {
          userName: 'XION User',
          customWallet: {
            walletName: 'Multi-Chain Wallet',
            walletAccounts: [
                // Cosmos chain accounts (Xion, Noble)
                {
                    curve: "CURVE_SECP256K1",
                    pathFormat: "PATH_FORMAT_BIP32",
                    path: "m/44'/118'/0'/0/0",
                    addressFormat: "ADDRESS_FORMAT_UNCOMPRESSED",
                },
                {
                    curve: "CURVE_SECP256K1",
                    pathFormat: "PATH_FORMAT_BIP32",
                    path: "m/44'/118'/0'/0/0",
                    addressFormat: "ADDRESS_FORMAT_COSMOS",
                },
                // EVM chain accounts (Base, Polygon, etc.)
                {
                    curve: "CURVE_SECP256K1",
                    pathFormat: "PATH_FORMAT_BIP32",
                    path: "m/44'/60'/0'/0/0", // Ethereum derivation path
                    addressFormat: "ADDRESS_FORMAT_ETHEREUM",
                }
            ],
          },
        },
      },
      autoRefreshSession: true,
    },

    // UI customization
    ui: {
      darkMode: false,
      colors: {
        light: {
          primary: '#6366f1', // Indigo primary color
        },
      },
    },
  };

  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onError: (error) => {
          console.error('Turnkey error:', error);
        },
        onAuthenticationSuccess: ({ session }) => {
          console.log('User authenticated:', session);
        },
        onSessionExpired: () => {
          console.log('Session expired, please log in again');
        },
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}
