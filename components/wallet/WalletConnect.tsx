import { AuthState } from '@turnkey/react-wallet-kit';

interface WalletConnectProps {
  authState: AuthState;
  xionAddress: string;
  nobleAddress: string;
  baseAddress: string;
  httpClient: any;
  handleLogin: () => void;
  debugWhoAmI: () => void;
  onCopyAddress: (address: string) => void;
}

export function WalletConnect({
  authState,
  xionAddress,
  nobleAddress,
  baseAddress,
  httpClient,
  handleLogin,
  debugWhoAmI,
  onCopyAddress,
}: WalletConnectProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-semibold mb-4">Connect Wallets</h2>

      {/* Turnkey (Xion/Noble) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cosmos Chains (Xion/Noble)
        </label>
        <button
          onClick={() => {
            console.log('🔘 Connect button clicked');
            console.log('   Auth state:', authState);
            console.log('   Is authenticated:', authState === AuthState.Authenticated);
            console.log('   handleLogin type:', typeof handleLogin);

            if (authState !== AuthState.Authenticated) {
              console.log('🚀 Calling handleLogin()...');
              handleLogin();
            } else {
              console.log('ℹ️ Already authenticated');
            }
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {xionAddress ? `Connected: ${xionAddress.slice(0, 12)}...` : 'Connect Turnkey'}
        </button>
        {xionAddress && (
          <div className="mt-2 text-sm text-gray-600">
            <div>Xion: {xionAddress}</div>
            <div>Noble: {nobleAddress}</div>
          </div>
        )}
      </div>

      {/* Base - derived from Turnkey */}
      {baseAddress && (
        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
          <div className="text-sm font-medium text-gray-700">Base (Turnkey)</div>
          <div className="text-xs text-gray-600 mt-1 break-all font-mono">
            {baseAddress}
          </div>
          <button
            onClick={() => onCopyAddress(baseAddress)}
            className="mt-2 text-xs text-purple-600 hover:text-purple-800"
          >
            📋 Copy address
          </button>
        </div>
      )}

      {/* Debug Button - Always visible */}
      <div className="mt-4">
        <button
          onClick={debugWhoAmI}
          disabled={!httpClient}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          🔍 Debug: Call Turnkey whoami (check console)
        </button>
      </div>
    </div>
  );
}
