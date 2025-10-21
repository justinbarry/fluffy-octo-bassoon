import { TurnkeyClient } from "@turnkey/http";
import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { base, baseSepolia } from "viem/chains";
import { destinations } from "@/config";

/**
 * Create an ethers signer with Turnkey for Base
 */
export async function createTurnkeyBaseSigner(
  turnkeyClient: TurnkeyClient,
  organizationId: string,
  signWith: string, // Wallet account ID, private key ID, or uncompressed public key
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<TurnkeySigner> {
  const rpcUrl = destinations.base.rpcUrl;

  console.log('🔧 Creating Turnkey Base signer with:', {
    organizationId,
    signWith: signWith.slice(0, 20) + '...',
    network,
    rpcUrl,
  });

  // Create ethers provider
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Create Turnkey signer
  const signer = new TurnkeySigner({
    client: turnkeyClient,
    organizationId,
    signWith,
  });

  // Connect signer to provider
  const connectedSigner = signer.connect(provider);

  const address = await connectedSigner.getAddress();
  console.log('✅ Turnkey ethers signer created:', {
    address,
    network,
  });

  return connectedSigner;
}

/**
 * Get the chain ID based on the current network
 */
export function getBaseChainId(network: "mainnet" | "sepolia" = "sepolia"): number {
  return destinations.base.chainId;
}

/**
 * Get the viem chain configuration (for viem-based utilities)
 */
export function getBaseChain(network: "mainnet" | "sepolia" = "sepolia") {
  return network === "mainnet" ? base : baseSepolia;
}
