import { BalanceCard } from './BalanceCard';
import { NobleActions } from './NobleActions';

interface BalanceSectionProps {
  xionAddress: string;
  nobleAddress: string;
  baseAddress: string;
  xionUsdcBalance: string;
  nobleUsdcBalance: string;
  baseUsdcBalance: number;
  nobleToXionAmount: string;
  nobleToBaseAmount: string;
  loading: boolean;
  onNobleToXionAmountChange: (value: string) => void;
  onNobleToBaseAmountChange: (value: string) => void;
  onTransferToXion: (amount: string) => void;
  onTransferToBase: (amount: string) => void;
}

export function BalanceSection({
  xionAddress,
  nobleAddress,
  baseAddress,
  xionUsdcBalance,
  nobleUsdcBalance,
  baseUsdcBalance,
  nobleToXionAmount,
  nobleToBaseAmount,
  loading,
  onNobleToXionAmountChange,
  onNobleToBaseAmountChange,
  onTransferToXion,
  onTransferToBase,
}: BalanceSectionProps) {
  if (!xionAddress && !baseAddress) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">Balances</h2>
      <div className="grid grid-cols-3 gap-4">
        {xionAddress && (
          <BalanceCard chain="xion" balance={xionUsdcBalance} />
        )}
        {nobleAddress && (
          <BalanceCard chain="noble" balance={nobleUsdcBalance}>
            {parseFloat(nobleUsdcBalance) > 0 && (
              <NobleActions
                nobleToXionAmount={nobleToXionAmount}
                nobleToBaseAmount={nobleToBaseAmount}
                loading={loading}
                hasBaseAddress={!!baseAddress}
                onNobleToXionAmountChange={onNobleToXionAmountChange}
                onNobleToBaseAmountChange={onNobleToBaseAmountChange}
                onTransferToXion={onTransferToXion}
                onTransferToBase={onTransferToBase}
              />
            )}
          </BalanceCard>
        )}
        {baseAddress && (
          <BalanceCard chain="base" balance={baseUsdcBalance} />
        )}
      </div>
    </div>
  );
}
