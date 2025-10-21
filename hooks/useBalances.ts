import { useState, useEffect } from 'react';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { sources } from '@/config';
import { getBaseUSDCBalance } from '@/utils/cctpBase';
import { microUnitsToUsdcFormatted } from '@/utils/conversions';
import { BALANCE_POLL_INTERVAL, getNetworkEnvironment } from '@/utils/constants';

interface BalancesReturn {
  xionUsdcBalance: string;
  nobleUsdcBalance: string;
  baseUsdcBalance: number;
}

export function useBalances(
  xionAddress: string,
  nobleAddress: string,
  baseAddress: string,
  xionQueryClient: CosmWasmClient | null,
  nobleQueryClient: CosmWasmClient | null
): BalancesReturn {
  const [xionUsdcBalance, setXionUsdcBalance] = useState<string>('0');
  const [nobleUsdcBalance, setNobleUsdcBalance] = useState<string>('0');
  const [baseUsdcBalance, setBaseUsdcBalance] = useState<number>(0);

  // Fetch Xion USDC balance
  useEffect(() => {
    const fetchXionBalance = async () => {
      if (!xionAddress || !xionQueryClient) return;

      try {
        const balance = await xionQueryClient.getBalance(xionAddress, sources.xion.usdcDenom);
        setXionUsdcBalance(microUnitsToUsdcFormatted(balance.amount, 2));
      } catch (error) {
        console.error('Error fetching Xion balance:', error);
      }
    };

    fetchXionBalance();
    const interval = setInterval(fetchXionBalance, BALANCE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [xionAddress, xionQueryClient]);

  // Fetch Noble USDC balance
  useEffect(() => {
    const fetchNobleBalance = async () => {
      if (!nobleAddress || !nobleQueryClient) return;

      try {
        const balance = await nobleQueryClient.getBalance(nobleAddress, 'uusdc');
        setNobleUsdcBalance(microUnitsToUsdcFormatted(balance.amount, 2));
      } catch (error) {
        console.error('Error fetching Noble balance:', error);
      }
    };

    fetchNobleBalance();
    const interval = setInterval(fetchNobleBalance, BALANCE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [nobleAddress, nobleQueryClient]);

  // Fetch Base USDC balance
  useEffect(() => {
    const fetchBaseBalance = async () => {
      if (!baseAddress) return;

      try {
        const network = getNetworkEnvironment();
        const balance = await getBaseUSDCBalance(baseAddress, network);
        setBaseUsdcBalance(balance);
      } catch (error) {
        console.error('Error fetching Base balance:', error);
      }
    };

    fetchBaseBalance();
    const interval = setInterval(fetchBaseBalance, BALANCE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [baseAddress]);

  return {
    xionUsdcBalance,
    nobleUsdcBalance,
    baseUsdcBalance,
  };
}
