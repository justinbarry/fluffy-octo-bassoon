import { useState, useEffect } from 'react';

interface CoinflowSessionReturn {
  sessionKey: string | null;
  withdrawerDetails: any;
  getSessionKey: () => Promise<string>;
  loadWithdrawerDetails: () => Promise<any>;
}

export function useCoinflowSession(baseAddress: string): CoinflowSessionReturn {
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [withdrawerDetails, setWithdrawerDetails] = useState<any>(null);

  // Session key storage helpers
  const getStoredSessionKey = (walletAddress: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const key = localStorage.getItem(`coinflow-session-key-${walletAddress}`);
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

      const url = `/api/coinflow/withdrawer?wallet=${encodeURIComponent(baseAddress)}&sessionKey=${encodeURIComponent(key)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Withdrawer API error:', errorData);
        throw new Error(`Failed to load withdrawer details: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      setWithdrawerDetails(data);
      console.log('✅ Withdrawer details loaded:', data);

      // Return data so caller can access bank accounts
      return data;
    } catch (err: any) {
      console.error('❌ Failed to load withdrawer details:', err);
      throw err;
    }
  };

  // Auto-load withdrawer details when baseAddress changes
  useEffect(() => {
    if (baseAddress) {
      console.log('🔄 Base address detected, will load withdrawer details...');
      const timer = setTimeout(() => {
        loadWithdrawerDetails();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [baseAddress]);

  return {
    sessionKey,
    withdrawerDetails,
    getSessionKey,
    loadWithdrawerDetails,
  };
}
