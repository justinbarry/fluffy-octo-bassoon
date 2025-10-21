interface TxHashes {
  ibcTransfer?: string;
  nobleBurn?: string;
  baseMint?: string;
}

interface TransactionHashesProps {
  txHashes: TxHashes;
}

export function TransactionHashes({ txHashes }: TransactionHashesProps) {
  if (Object.keys(txHashes).length === 0) return null;

  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg text-sm">
      <div className="font-medium mb-2">Transaction Hashes:</div>
      {txHashes.ibcTransfer && (
        <div className="mb-1 break-all">
          <span className="font-medium">IBC:</span> {txHashes.ibcTransfer}
        </div>
      )}
      {txHashes.nobleBurn && (
        <div className="mb-1 break-all">
          <span className="font-medium">Burn:</span> {txHashes.nobleBurn}
        </div>
      )}
      {txHashes.baseMint && (
        <div className="break-all">
          <span className="font-medium">Mint:</span> {txHashes.baseMint}
        </div>
      )}
    </div>
  );
}
