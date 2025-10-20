import {
  type WalletClient,
  type PublicClient,
  createPublicClient,
  http,
  parseAbi,
  type Hash,
} from "viem";
import { BASE_RPC_URL, BASE_USDC_ADDRESS, BASE_CCTP_CONTRACTS, BASE_CONFIG } from "@/config/api";
import { getBaseChain } from "./turnkeyBase";

// ERC-20 ABI (minimal - just what we need)
const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// CCTP MessageTransmitter ABI (minimal)
const MESSAGE_TRANSMITTER_ABI = parseAbi([
  "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
]);

/**
 * Get USDC balance for a Base address
 */
export async function getBaseUSDCBalance(
  address: string,
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<number> {
  const chain = getBaseChain(network);

  const publicClient = createPublicClient({
    chain,
    transport: http(BASE_RPC_URL),
  });

  try {
    const balance = await publicClient.readContract({
      address: BASE_USDC_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    // USDC has 6 decimals
    return Number(balance) / 1_000_000;
  } catch (error) {
    console.error("Error fetching Base USDC balance:", error);
    return 0;
  }
}

/**
 * Mint USDC on Base using CCTP with Turnkey wallet client
 */
export async function mintUSDCOnBaseWithTurnkey(
  walletClient: WalletClient,
  message: Uint8Array,
  attestation: string,
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<Hash> {
  const chain = getBaseChain(network);
  const messageTransmitterAddress = BASE_CCTP_CONTRACTS.MESSAGE_TRANSMITTER;

  console.log("Minting USDC on Base via CCTP...");
  console.log("Message Transmitter:", messageTransmitterAddress);
  console.log("Message length:", message.length);
  console.log("Attestation length:", attestation.length);

  try {
    // Convert message to hex
    const messageHex = `0x${Buffer.from(message).toString("hex")}` as `0x${string}`;

    // Ensure attestation is properly formatted
    const attestationHex = attestation.startsWith("0x")
      ? (attestation as `0x${string}`)
      : (`0x${attestation}` as `0x${string}`);

    // Call receiveMessage on MessageTransmitter
    const hash = await walletClient.writeContract({
      address: messageTransmitterAddress as `0x${string}`,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: "receiveMessage",
      args: [messageHex, attestationHex],
      chain,
      account: walletClient.account!,
    });

    console.log("CCTP mint transaction sent:", hash);
    return hash;
  } catch (error) {
    console.error("Error minting USDC on Base:", error);
    throw error;
  }
}

/**
 * Wait for a transaction to be confirmed on Base
 */
export async function waitForBaseTransaction(
  hash: Hash,
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<boolean> {
  const chain = getBaseChain(network);

  const publicClient = createPublicClient({
    chain,
    transport: http(BASE_RPC_URL),
  });

  try {
    console.log("Waiting for Base transaction confirmation:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    console.log("Transaction confirmed:", receipt.status === "success");
    return receipt.status === "success";
  } catch (error) {
    console.error("Error waiting for Base transaction:", error);
    return false;
  }
}

/**
 * Estimate gas for CCTP mint operation
 */
export async function estimateMintGas(
  walletClient: WalletClient,
  message: Uint8Array,
  attestation: string,
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<bigint> {
  const chain = getBaseChain(network);
  const messageTransmitterAddress = BASE_CCTP_CONTRACTS.MESSAGE_TRANSMITTER;
  const messageHex = `0x${Buffer.from(message).toString("hex")}` as `0x${string}`;
  const attestationHex = attestation.startsWith("0x")
    ? (attestation as `0x${string}`)
    : (`0x${attestation}` as `0x${string}`);

  try {
    // Create a public client for gas estimation
    const publicClient = createPublicClient({
      chain,
      transport: http(BASE_RPC_URL),
    });

    const gas = await publicClient.estimateContractGas({
      address: messageTransmitterAddress as `0x${string}`,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: "receiveMessage",
      args: [messageHex, attestationHex],
      account: walletClient.account!,
    });

    return gas;
  } catch (error) {
    console.error("Error estimating gas:", error);
    // Return a default gas estimate if estimation fails
    return BigInt(200000);
  }
}

/**
 * Get current Base network gas price
 */
export async function getBaseGasPrice(
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<bigint> {
  const chain = getBaseChain(network);

  const publicClient = createPublicClient({
    chain,
    transport: http(BASE_RPC_URL),
  });

  try {
    const gasPrice = await publicClient.getGasPrice();
    return gasPrice;
  } catch (error) {
    console.error("Error fetching gas price:", error);
    return BigInt(0);
  }
}

/**
 * Format Base address to 32-byte format for CCTP (with left padding)
 */
export function formatAddressForCCTP(address: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;

  // Base addresses are 20 bytes (40 hex chars), CCTP expects 32 bytes
  // Pad with zeros on the left
  const paddedAddress = cleanAddress.padStart(64, "0");

  // Convert to Uint8Array
  return new Uint8Array(
    paddedAddress.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
}

/**
 * Parse a Base address from CCTP 32-byte format
 */
export function parseAddressFromCCTP(bytes: Uint8Array): string {
  // CCTP stores addresses as 32 bytes, but Base addresses are only 20 bytes
  // Extract the last 20 bytes
  const addressBytes = bytes.slice(-20);
  const address = `0x${Buffer.from(addressBytes).toString("hex")}`;
  return address;
}
