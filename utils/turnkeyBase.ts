import { createAccount } from "@turnkey/viem";
import { type TurnkeyApiClient } from "@turnkey/sdk-server";
import { createWalletClient, http, type WalletClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import { BASE_CHAIN_ID, BASE_RPC_URL } from "@/config/api";

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

  console.log('🔧 Creating Turnkey Base client with:', {
    organizationId,
    signWith,
    ethereumAddress,
    network,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId,
    signWith, // Wallet account ID, private key ID, or uncompressed public key
    ethereumAddress: ethereumAddress, // Provide the known address
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount,
    chain,
    transport: http(BASE_RPC_URL),
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
