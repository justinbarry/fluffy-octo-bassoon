import { createAccount } from "@turnkey/viem";
import { type TurnkeyApiClient } from "@turnkey/sdk-server";
import { createWalletClient, http, type WalletClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import { destinations } from "@/config";

/**
 * Create a viem wallet client with Turnkey signer for Base
 */
export async function createTurnkeyBaseClient(
  turnkeyClient: { apiClient: () => TurnkeyApiClient },
  organizationId: string,
  signWith: string, // Can be: wallet account ID, private key ID, or uncompressed public key
  ethereumAddress: string,
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<WalletClient> {
  const chain = network === "mainnet" ? base : baseSepolia;

  // Normalize ethereum address to lowercase (Turnkey requirement)
  const normalizedAddress = ethereumAddress.toLowerCase();

  console.log('🔧 Creating Turnkey Base client with:', {
    organizationId,
    signWith,
    ethereumAddress: normalizedAddress,
    network,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId,
    signWith, // Wallet account ID, private key ID, or uncompressed public key
    ethereumAddress: normalizedAddress, // Provide the known address (lowercase)
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount,
    chain,
    transport: http(destinations.base.rpcUrl),
  });

  console.log('✅ Turnkey account created:', {
    address: turnkeyAccount.address,
    type: turnkeyAccount.type,
  });

  return walletClient;
}

/**
 * Derive the Base (Ethereum) address from a Turnkey wallet
 */
export async function deriveBaseAddress(
  turnkeyClient: { apiClient: () => TurnkeyApiClient },
  organizationId: string,
  privateKeyId: string
): Promise<string> {
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId,
    signWith: privateKeyId,
    ethereumAddress: "", // Will be derived
  });

  return turnkeyAccount.address;
}

/**
 * Get the chain configuration based on the current network
 */
export function getBaseChain(network: "mainnet" | "sepolia" = "sepolia") {
  return network === "mainnet" ? base : baseSepolia;
}
