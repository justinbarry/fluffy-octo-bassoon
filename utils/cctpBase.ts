import {
  type WalletClient,
  type PublicClient,
  createPublicClient,
  http,
  parseAbi,
  type Hash,
} from "viem";
import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import { destinations } from "@/config";
import { getBaseChain } from "./turnkeyBase";
import { ensureHexPrefix, removeHexPrefix } from "./conversions";

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
    transport: http(destinations.base.rpcUrl),
  });

  try {
    const balance = await publicClient.readContract({
      address: destinations.base.usdcAddress as `0x${string}`,
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
  const messageTransmitterAddress = destinations.base.cctp.messageTransmitter;

  console.log("Minting USDC on Base via CCTP...");
  console.log("Message Transmitter:", messageTransmitterAddress);
  console.log("Message length:", message.length);
  console.log("Attestation length:", attestation.length);

  try {
    // Convert message to hex
    const messageHex = ensureHexPrefix(Buffer.from(message).toString("hex")) as `0x${string}`;

    // Ensure attestation is properly formatted
    const attestationHex = ensureHexPrefix(attestation) as `0x${string}`;

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
    transport: http(destinations.base.rpcUrl),
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
  const messageTransmitterAddress = destinations.base.cctp.messageTransmitter;
  const messageHex = ensureHexPrefix(Buffer.from(message).toString("hex")) as `0x${string}`;
  const attestationHex = ensureHexPrefix(attestation) as `0x${string}`;

  try {
    // Create a public client for gas estimation
    const publicClient = createPublicClient({
      chain,
      transport: http(destinations.base.rpcUrl),
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
    transport: http(destinations.base.rpcUrl),
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
 * Mint USDC on Base using CCTP with Turnkey ethers signer
 */
export async function mintUSDCOnBaseWithEthers(
  signer: TurnkeySigner,
  message: Uint8Array,
  attestation: string,
  network: "mainnet" | "sepolia" = "sepolia"
): Promise<string> {
  const messageTransmitterAddress = destinations.base.cctp.messageTransmitter;

  console.log("Minting USDC on Base via CCTP with ethers...");
  console.log("Message Transmitter:", messageTransmitterAddress);
  console.log("Message length:", message.length);
  console.log("Attestation length:", attestation.length);

  try {
    // Message Transmitter ABI
    const abi = [
      "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)"
    ];

    const contract = new ethers.Contract(messageTransmitterAddress, abi, signer);

    // Convert to hex strings
    const messageHex = ensureHexPrefix(Buffer.from(message).toString("hex"));
    const attestationHex = ensureHexPrefix(attestation);

    // Call receiveMessage
    const tx = await contract.receiveMessage(messageHex, attestationHex);
    console.log("CCTP mint transaction sent:", tx.hash);

    // Wait for confirmation
    await tx.wait();
    console.log("CCTP mint transaction confirmed");

    return tx.hash;
  } catch (error) {
    console.error("Error minting USDC on Base:", error);
    throw error;
  }
}

// Re-export address formatting functions from conversions.ts for backwards compatibility
export { formatAddressForCCTP, parseAddressFromCCTP } from "./conversions";
