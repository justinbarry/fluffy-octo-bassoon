import { BankAccountSelector } from './BankAccountSelector';
import { WithdrawalSpeedSelector } from './WithdrawalSpeedSelector';

type WithdrawalSpeed = 'standard' | 'same_day' | 'asap';

interface CoinflowWithdrawalProps {
  baseAddress: string;
  baseUsdcBalance: number;
  cctpStep: string;
  withdrawerDetails: any;
  withdrawAmount: string;
  withdrawing: boolean;
  withdrawalTxHash: string;
  selectedBankAccount: string;
  selectedSpeed: WithdrawalSpeed;
  quote: any;
  gettingQuote: boolean;
  onWithdrawAmountChange: (value: string) => Promise<void>;
  onBankAccountChange: (token: string) => void;
  onSpeedChange: (speed: WithdrawalSpeed) => void;
  onWithdraw: () => void;
  onWithdrawGasless: () => void;
  onBankAccountLink: () => void;
  onRefreshWithdrawer: () => void;
}

export function CoinflowWithdrawal({
  baseAddress,
  baseUsdcBalance,
  cctpStep,
  withdrawerDetails,
  withdrawAmount,
  withdrawing,
  withdrawalTxHash,
  selectedBankAccount,
  selectedSpeed,
  quote,
  gettingQuote,
  onWithdrawAmountChange,
  onBankAccountChange,
  onSpeedChange,
  onWithdraw,
  onWithdrawGasless,
  onBankAccountLink,
  onRefreshWithdrawer,
}: CoinflowWithdrawalProps) {
  if (!baseAddress || baseUsdcBalance <= 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4">Withdraw to Bank Account</h2>
      <p className="text-sm text-gray-600 mb-4">
        {cctpStep === 'complete' && 'USDC has been successfully bridged to Base via CCTP!'}
        {cctpStep !== 'complete' && `You have $${baseUsdcBalance.toFixed(2)} USDC on Base.`}
      </p>

      {/* Show bank accounts if available */}
      {withdrawerDetails?.withdrawer?.bankAccounts?.length > 0 ? (
        <div>
          <BankAccountSelector
            bankAccounts={withdrawerDetails.withdrawer.bankAccounts}
            selectedBankAccount={selectedBankAccount}
            onBankAccountChange={onBankAccountChange}
            onRefresh={onRefreshWithdrawer}
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => onWithdrawAmountChange(e.target.value)}
              max={baseUsdcBalance}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter amount"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available: ${baseUsdcBalance.toFixed(2)} USDC
            </p>
          </div>

          {gettingQuote && (
            <div className="mb-4 text-sm text-gray-500">Getting quote...</div>
          )}

          {quote && (
            <WithdrawalSpeedSelector
              quote={quote}
              selectedSpeed={selectedSpeed}
              onSpeedChange={onSpeedChange}
            />
          )}

          <div className="flex gap-3 mb-4">
            <button
              onClick={onWithdraw}
              disabled={
                withdrawing ||
                !withdrawAmount ||
                parseFloat(withdrawAmount) <= 0 ||
                parseFloat(withdrawAmount) > baseUsdcBalance
              }
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {withdrawing ? 'Processing...' : 'Withdraw (With Gas)'}
            </button>
            <button
              onClick={onWithdrawGasless}
              disabled={
                withdrawing ||
                !withdrawAmount ||
                parseFloat(withdrawAmount) <= 0 ||
                parseFloat(withdrawAmount) > baseUsdcBalance
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {withdrawing ? 'Processing...' : 'Gasless Withdraw ⚡'}
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-4 text-center">
            💡 Gasless withdrawal uses EIP-712 permit signing - no Base gas fees required!
          </p>

          {withdrawalTxHash && (
            <div className="mb-4 p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-800 break-all">
                <strong>Transaction Hash:</strong>
                <br />
                {withdrawalTxHash}
              </p>
            </div>
          )}

          <button
            onClick={onBankAccountLink}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            + Add Another Bank Account
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={onBankAccountLink}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors mb-4"
          >
            Link Bank Account & Withdraw
          </button>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>First-time users:</strong> You'll be redirected to Coinflow to:
              <br />
              1. Verify your email
              <br />
              2. Complete KYC verification (identity check)
              <br />
              3. Link your bank account (ACH for US, IBAN for EU, etc.)
              <br />
              4. Set up and complete your withdrawal
              <br />
              <br />
              After linking your bank, you'll be returned to this page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
