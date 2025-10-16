# Xion → Noble → Solana CCTP + Coinflow Withdrawal Demo

A comprehensive demo showcasing Cross-Chain Transfer Protocol (CCTP) for bridging USDC from Xion to Solana via Noble, with integrated Coinflow bank withdrawal functionality.

## 🌉 Architecture Overview

```
┌─────────┐     IBC      ┌───────┐    CCTP Burn    ┌─────────┐
│  Xion   │ ────────────>│ Noble │ ────────────────>│ Solana  │
│  USDC   │              │  USDC │                  │  USDC   │
└─────────┘              └───────┘                  └─────────┘
                                                           │
                                                           │
                                                           v
                                                    ┌──────────────┐
                                                    │   Coinflow   │
                                                    │  Withdrawal  │
                                                    │  (to bank)   │
                                                    └──────────────┘
```

## ✨ Features

- **Multi-Chain CCTP Bridge**: Transfer USDC from Xion → Noble → Solana
- **Dual Wallet Integration**:
  - Turnkey for Xion/Noble (Cosmos chains)
  - Solana Wallet Adapter (Phantom, Solflare, etc.)
- **Circle CCTP Integration**: Native burn-and-mint USDC transfers
- **Coinflow Widget**: Pre-built UI for bank withdrawals on Solana
- **Real-time Progress Tracking**: Step-by-step visual feedback
- **Error Handling**: Comprehensive error messages and recovery

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Turnkey account and organization ID
- Coinflow merchant account
- Test USDC on Xion testnet

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd xion-solana-coinflow-demo-cc
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_COINFLOW_ENV=sandbox
NEXT_PUBLIC_COINFLOW_MERCHANT_ID=your_merchant_id
NEXT_PUBLIC_TURNKEY_ORG_ID=your_turnkey_org_id
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## 📋 How It Works

### Step 1: IBC Transfer (Xion → Noble)
- User initiates USDC transfer from Xion
- IBC message sent to Noble
- Settles in ~8 seconds

### Step 2: CCTP Burn on Noble
- Burns USDC on Noble using CCTP module
- Generates burn message and nonce
- Message includes Solana destination

### Step 3: Circle Attestation
- Poll Circle's Iris API for attestation
- Typically takes 2-3 minutes
- Attestation authorizes mint on destination

### Step 4: CCTP Mint on Solana
- Submit message + attestation to Solana CCTP program
- USDC minted to user's Solana wallet
- Transaction signed with Solana wallet

### Step 5: Coinflow Withdrawal
- Coinflow widget appears after successful mint
- User can withdraw USDC to linked bank account
- Choose speed: Standard (2-3 days), Same Day, or ASAP

## 🔧 Technical Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Coinflow React SDK**: Pre-built withdrawal widget

### Blockchain Integration
- **@cosmjs/stargate**: Cosmos chain interactions (Xion/Noble)
- **@solana/web3.js**: Solana blockchain interaction
- **@solana/wallet-adapter**: Multi-wallet support
- **@turnkey/react-wallet-kit**: Passkey-based Cosmos wallets

### CCTP
- Noble CCTP Module (MsgDepositForBurn)
- Circle Iris API (attestation service)
- Solana CCTP Program (MessageTransmitter)

## 📁 Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx             # Main CCTP flow UI
│   ├── providers.tsx        # Wallet providers setup
│   └── globals.css          # Global styles
├── config/
│   └── api.ts              # Chain configs (Xion, Noble, Solana)
├── types/
│   └── cctp.ts             # TypeScript types
├── utils/
│   ├── cctp.ts             # Attestation fetching
│   ├── cctpNoble.ts        # Noble burn functions
│   └── cctpSolana.ts       # Solana mint functions
├── proto/
│   └── circle/             # Noble CCTP protobuf types
└── components/              # (to be created)
```

## 🐛 Troubleshooting

### Wallet Connection Issues
- **Turnkey**: Ensure TURNKEY_ORG_ID is correctly set
- **Solana**: Install Phantom or Solflare browser extension

### CCTP Transfer Failures
- **Noble Burn**: Check USDC balance on Noble
- **Attestation Timeout**: Circle API may be slow, wait up to 5 minutes
- **Solana Mint**: Ensure sufficient SOL for gas fees

### Coinflow Issues
- **Widget Not Showing**: Verify USDC arrived on Solana
- **Bank Linking**: Use Coinflow's sandbox environment for testing

## 📚 Resources

- [Circle CCTP Docs](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [Solana CCTP Contracts](https://github.com/circlefin/solana-cctp-contracts)
- [Coinflow Documentation](https://integration-builder.coinflow.cash)
- [Turnkey Docs](https://docs.turnkey.com)

## 🔐 Security Considerations

- Never commit `.env.local` to version control
- API keys should be server-side only
- Turnkey provides passkey-based security (no seed phrases)
- Coinflow handles PII securely in their widget

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## ⚠️ Disclaimer

This is a demo application for educational purposes. Test thoroughly before using in production.
