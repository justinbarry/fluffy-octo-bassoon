import { StatusMessage } from '../shared/StatusMessage';
import { ProgressSteps } from './ProgressSteps';
import { TransactionHashes } from './TransactionHashes';

type CCTPStep = 'idle' | 'ibc' | 'burn' | 'attest' | 'mint' | 'complete';

interface TxHashes {
  ibcTransfer?: string;
  nobleBurn?: string;
  baseMint?: string;
}

interface CCTPBridgeFormProps {
  transferAmount: string;
  statusMessage: string;
  error: string;
  cctpStep: CCTPStep;
  txHashes: TxHashes;
  loading: boolean;
  xionAddress: string;
  baseAddress: string;
  onTransferAmountChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function CCTPBridgeForm({
  transferAmount,
  statusMessage,
  error,
  cctpStep,
  txHashes,
  loading,
  xionAddress,
  baseAddress,
  onTransferAmountChange,
  onSubmit,
  onReset,
}: CCTPBridgeFormProps) {
  if (cctpStep === 'complete') return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">CCTP Bridge</h2>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount (USDC)
        </label>
        <input
          type="number"
          value={transferAmount}
          onChange={(e) => onTransferAmountChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter amount"
          disabled={loading || cctpStep !== 'idle'}
        />
      </div>

      {/* Status & Error Messages */}
      <StatusMessage message={statusMessage} error={error} />

      {/* Progress Steps */}
      <ProgressSteps currentStep={cctpStep} />

      {/* Transaction Hashes */}
      <TransactionHashes txHashes={txHashes} />

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onSubmit}
          disabled={loading || cctpStep !== 'idle' || !xionAddress || !baseAddress}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Processing...' : 'Start CCTP Transfer'}
        </button>
        {cctpStep !== 'idle' && (
          <button
            onClick={onReset}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
