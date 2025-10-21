interface BankAccount {
  token: string;
  name: string;
  mask: string;
}

interface BankAccountSelectorProps {
  bankAccounts: BankAccount[];
  selectedBankAccount: string;
  onBankAccountChange: (token: string) => void;
  onRefresh: () => void;
}

export function BankAccountSelector({
  bankAccounts,
  selectedBankAccount,
  onBankAccountChange,
  onRefresh,
}: BankAccountSelectorProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-700">Your Bank Accounts</h3>
        <button
          onClick={onRefresh}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          🔄 Refresh
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Bank Account
        </label>
        <select
          value={selectedBankAccount}
          onChange={(e) => onBankAccountChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {bankAccounts.map((account) => (
            <option key={account.token} value={account.token}>
              {account.name} - {account.mask}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
