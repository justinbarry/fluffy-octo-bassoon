type WithdrawalSpeed = 'standard' | 'same_day' | 'asap';

interface Quote {
  standard: { finalSettlement: { cents: number }; fee: { cents: number } };
  same_day: { finalSettlement: { cents: number }; fee: { cents: number } };
  asap: { finalSettlement: { cents: number }; fee: { cents: number } };
  gasFees?: { gasFees: { cents: number } };
}

interface WithdrawalSpeedSelectorProps {
  quote: Quote;
  selectedSpeed: WithdrawalSpeed;
  onSpeedChange: (speed: WithdrawalSpeed) => void;
}

export function WithdrawalSpeedSelector({
  quote,
  selectedSpeed,
  onSpeedChange,
}: WithdrawalSpeedSelectorProps) {
  return (
    <div className="mb-4 space-y-3">
      <div className="text-sm font-medium text-gray-700 mb-2">Select withdrawal speed:</div>

      {/* Standard ACH */}
      <div
        className={`p-3 border rounded-lg cursor-pointer transition-all ${
          selectedSpeed === 'standard'
            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
            : 'hover:bg-gray-50 border-gray-300'
        }`}
        onClick={() => onSpeedChange('standard')}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium">Standard ACH (2-3 business days)</span>
          <span className="text-green-600 font-medium">
            ${(quote.standard.finalSettlement.cents / 100).toFixed(2)}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Fee: ${(quote.standard.fee.cents / 100).toFixed(2)}
        </div>
      </div>

      {/* ASAP */}
      <div
        className={`p-3 border rounded-lg cursor-pointer transition-all ${
          selectedSpeed === 'asap'
            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
            : 'hover:bg-gray-50 border-gray-300'
        }`}
        onClick={() => onSpeedChange('asap')}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium">ASAP (Minutes)</span>
          <span className="text-green-600 font-medium">
            ${(quote.asap.finalSettlement.cents / 100).toFixed(2)}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Fee: ${(quote.asap.fee.cents / 100).toFixed(2)}
        </div>
      </div>

      {/* Same Day ACH */}
      <div
        className={`p-3 border rounded-lg cursor-pointer transition-all ${
          selectedSpeed === 'same_day'
            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
            : 'hover:bg-gray-50 border-gray-300'
        }`}
        onClick={() => onSpeedChange('same_day')}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium">Same Day ACH</span>
          <span className="text-green-600 font-medium">
            ${(quote.same_day.finalSettlement.cents / 100).toFixed(2)}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Fee: ${(quote.same_day.fee.cents / 100).toFixed(2)}
        </div>
      </div>

      {quote.gasFees?.gasFees?.cents && quote.gasFees.gasFees.cents > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          Gas fees: ${(quote.gasFees.gasFees.cents / 100).toFixed(2)}
        </div>
      )}
    </div>
  );
}
