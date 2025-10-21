interface NobleActionsProps {
  nobleToXionAmount: string;
  nobleToBaseAmount: string;
  loading: boolean;
  hasBaseAddress: boolean;
  onNobleToXionAmountChange: (value: string) => void;
  onNobleToBaseAmountChange: (value: string) => void;
  onTransferToXion: (amount: string) => void;
  onTransferToBase: (amount: string) => void;
}

export function NobleActions({
  nobleToXionAmount,
  nobleToBaseAmount,
  loading,
  hasBaseAddress,
  onNobleToXionAmountChange,
  onNobleToBaseAmountChange,
  onTransferToXion,
  onTransferToBase,
}: NobleActionsProps) {
  return (
    <div className="mt-3 space-y-2">
      {/* IBC to Xion */}
      <div>
        <input
          type="number"
          value={nobleToXionAmount}
          onChange={(e) => onNobleToXionAmountChange(e.target.value)}
          placeholder="Amount (or leave empty for all)"
          disabled={loading}
          className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1"
        />
        <button
          onClick={() => onTransferToXion(nobleToXionAmount)}
          disabled={loading}
          className="w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-1 px-2 rounded"
        >
          ← IBC to Xion
        </button>
      </div>
      {/* CCTP to Base */}
      <div>
        <input
          type="number"
          value={nobleToBaseAmount}
          onChange={(e) => onNobleToBaseAmountChange(e.target.value)}
          placeholder="Amount (or leave empty for all)"
          disabled={loading || !hasBaseAddress}
          className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1"
        />
        <button
          onClick={() => onTransferToBase(nobleToBaseAmount)}
          disabled={loading || !hasBaseAddress}
          className="w-full text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1 px-2 rounded"
        >
          → CCTP to Base
        </button>
      </div>
    </div>
  );
}
