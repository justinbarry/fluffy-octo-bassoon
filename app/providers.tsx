'use client';

import React from 'react';
import { TurnkeyProvider } from '@turnkey/react-wallet-kit';

export function Providers({ children }: { children: React.ReactNode }) {
  const turnkeyOrgId = process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || '';

  return (
    <TurnkeyProvider
      config={{
        organizationId: turnkeyOrgId,
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}
