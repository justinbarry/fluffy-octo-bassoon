import { type WalletClient } from "viem";

/**
 * Adapter to convert Turnkey viem WalletClient to Coinflow's expected wallet interface
 */
export function createCoinflowWalletAdapter(walletClient: WalletClient | null, address: string | null) {
  if (!walletClient || !address) {
    return null;
  }

  return {
    address,

    sendTransaction: async (transaction: any) => {
      // Send transaction using viem wallet client
      const hash = await walletClient.sendTransaction({
        to: transaction.to as `0x${string}`,
        value: transaction.value ? BigInt(transaction.value) : undefined,
        data: transaction.data as `0x${string}` | undefined,
        gas: transaction.gas ? BigInt(transaction.gas) : undefined,
        gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined,
        account: walletClient.account!,
      });

      return { hash };
    },

    signMessage: async (message: string) => {
      try {
        // Try to parse as EIP-712 typed data first
        const typedData = JSON.parse(message);

        if (typedData.types && typedData.domain && typedData.message) {
          // This is EIP-712 typed data
          const signature = await walletClient.signTypedData({
            account: walletClient.account!,
            domain: typedData.domain,
            types: typedData.types,
            primaryType: Object.keys(typedData.types).find(key => key !== 'EIP712Domain') || '',
            message: typedData.message,
          });
          return signature;
        }
      } catch (e) {
        // Not valid JSON or not EIP-712 format, fall through to regular message signing
        console.log('Not EIP-712 typed data, using regular message signing');
      }

      // Sign as regular message
      const signature = await walletClient.signMessage({
        account: walletClient.account!,
        message,
      });

      return signature;
    },
  };
}
