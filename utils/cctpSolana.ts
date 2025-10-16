/**
 * CCTP Solana Integration
 * Handles minting USDC on Solana via CCTP program
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Commitment,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { SOLANA_CONFIG, SOLANA_USDC_MINT, SOLANA_CCTP_CONTRACTS } from '@/config/api';
import { CCTPMintResult } from '@/types/cctp';

/**
 * Mint USDC on Solana using CCTP
 *
 * This function calls the receiveMessage instruction on the Solana CCTP MessageTransmitter program
 * with the message bytes from Noble burn and the attestation signature from Circle's API
 *
 * @param connection - Solana connection object
 * @param wallet - Solana wallet adapter wallet
 * @param messageBytes - Message bytes from Noble burn transaction (as hex string with 0x prefix)
 * @param attestation - Attestation signature from Circle's Iris API (as hex string with 0x prefix)
 * @returns Mint transaction result
 */
export async function mintUSDCOnSolana(
  connection: Connection,
  wallet: WalletContextState,
  messageBytes: string,
  attestation: string
): Promise<CCTPMintResult> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  console.log('💰 Initiating CCTP mint on Solana:', {
    wallet: wallet.publicKey.toBase58(),
    messageLength: messageBytes.length,
    attestationLength: attestation.length
  });

  try {
    // Convert hex strings to Buffer (remove 0x prefix if present)
    const messageBytesBuffer = Buffer.from(
      messageBytes.startsWith('0x') ? messageBytes.slice(2) : messageBytes,
      'hex'
    );
    const attestationBuffer = Buffer.from(
      attestation.startsWith('0x') ? attestation.slice(2) : attestation,
      'hex'
    );

    // Get USDC mint and recipient token account
    const usdcMint = new PublicKey(SOLANA_USDC_MINT);
    const recipientTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      wallet.publicKey
    );

    // Check if token account exists, create if not
    const accountInfo = await connection.getAccountInfo(recipientTokenAccount);
    const transaction = new Transaction();

    if (!accountInfo) {
      console.log('📝 Creating associated token account for USDC...');
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        recipientTokenAccount, // ata
        wallet.publicKey, // owner
        usdcMint // mint
      );
      transaction.add(createATAInstruction);
    }

    // Create the receiveMessage instruction for CCTP MessageTransmitter program
    const messageTransmitterProgram = new PublicKey(
      SOLANA_CCTP_CONTRACTS.MESSAGE_TRANSMITTER
    );

    // Build the receiveMessage instruction
    // Note: This is a simplified version. The actual implementation requires:
    // 1. Deriving the correct PDA accounts
    // 2. Including all necessary accounts in the correct order
    // 3. Encoding the instruction data properly
    //
    // For a production implementation, use Circle's SDK or reference implementation:
    // https://github.com/circlefin/solana-cctp-contracts

    const receiveMessageInstruction = await buildReceiveMessageInstruction(
      messageTransmitterProgram,
      messageBytesBuffer,
      attestationBuffer,
      wallet.publicKey,
      recipientTokenAccount,
      usdcMint
    );

    transaction.add(receiveMessageInstruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign and send transaction
    console.log('📤 Sending CCTP mint transaction to Solana...');
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed' as Commitment,
    });

    console.log('⏳ Waiting for transaction confirmation...');
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log('✅ CCTP mint successful on Solana:', signature);

    return {
      transactionHash: signature,
      success: true
    };
  } catch (error: any) {
    console.error('❌ CCTP mint failed on Solana:', error);

    // Check for common errors
    if (error.message?.includes('already been used')) {
      throw new Error('This CCTP message has already been used. The transfer may have already completed.');
    }

    throw error;
  }
}

/**
 * Build the receiveMessage instruction for Solana CCTP
 *
 * This is a placeholder that needs to be implemented based on Circle's Solana CCTP contracts.
 * The actual implementation requires:
 * - Deriving message PDA from nonce
 * - Including authority PDAs
 * - Proper instruction data encoding
 *
 * Reference: https://github.com/circlefin/solana-cctp-contracts
 */
async function buildReceiveMessageInstruction(
  programId: PublicKey,
  messageBytes: Buffer,
  attestation: Buffer,
  authority: PublicKey,
  recipientTokenAccount: PublicKey,
  usdcMint: PublicKey
): Promise<TransactionInstruction> {
  // TODO: Implement actual instruction building
  // This requires:
  // 1. Parsing the message to extract nonce and other fields
  // 2. Deriving the correct PDA addresses
  // 3. Including all required accounts
  // 4. Encoding instruction data per Circle's spec

  // For now, return a placeholder instruction
  // In production, use Circle's SDK or follow their exact implementation

  const data = Buffer.concat([
    Buffer.from([0]), // instruction discriminator for receiveMessage
    Buffer.from(messageBytes),
    attestation
  ]);

  return new TransactionInstruction({
    keys: [
      // Note: This is incomplete - actual implementation needs many more accounts
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Get Solana USDC balance for a wallet
 */
export async function getSolanaUSDCBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const usdcMint = new PublicKey(SOLANA_USDC_MINT);
    const tokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      walletAddress
    );

    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return parseFloat(balance.value.uiAmount?.toString() || '0');
  } catch (error) {
    console.error('Error fetching Solana USDC balance:', error);
    return 0;
  }
}

/**
 * Format Solana USDC balance
 */
export function formatSolanaUSDC(amount: number): string {
  return amount.toFixed(2);
}
