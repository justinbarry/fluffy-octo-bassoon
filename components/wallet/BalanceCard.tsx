interface BalanceCardProps {
  chain: 'xion' | 'noble' | 'base';
  balance: string | number;
  children?: React.ReactNode;
}

const colorClasses = {
  xion: 'bg-indigo-50',
  noble: 'bg-blue-50',
  base: 'bg-purple-50',
};

const labels = {
  xion: 'Xion USDC',
  noble: 'Noble USDC',
  base: 'Base USDC',
};

export function BalanceCard({ chain, balance, children }: BalanceCardProps) {
  const formattedBalance = typeof balance === 'number' ? balance.toFixed(2) : balance;

  return (
    <div className={`p-4 ${colorClasses[chain]} rounded-lg`}>
      <div className="text-sm text-gray-600">{labels[chain]}</div>
      <div className="text-2xl font-bold">${formattedBalance}</div>
      {children}
    </div>
  );
}
