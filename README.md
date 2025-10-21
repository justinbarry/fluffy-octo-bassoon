# Xion → Noble → Base CCTP + Coinflow Withdrawal Demo

A comprehensive demo showcasing Cross-Chain Transfer Protocol (CCTP) for bridging USDC from Xion to Base via Noble, with integrated Coinflow bank withdrawal functionality.

## 🌉 Architecture Overview

```
┌─────────┐     IBC      ┌───────┐    CCTP Burn    ┌─────────┐
│  Xion   │ ────────────>│ Noble │ ────────────────>│  Base   │
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

- **Multi-Chain CCTP Bridge**: Transfer USDC from Xion → Noble → Base
- **Turnkey Wallet Integration**: Passkey-based wallets for Xion, Noble, and Base
- **Circle CCTP Integration**: Native burn-and-mint USDC transfers
- **Coinflow Widget**: Pre-built UI for bank withdrawals on Base
- **Real-time Progress Tracking**: Step-by-step visual feedback
- **Error Handling**: Comprehensive error messages and recovery
- **Gasless Withdrawals**: Support for EIP-712 permit signatures

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
cd xion-base-coinflow-demo
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
NEXT_PUBLIC_BASE_NETWORK=sepolia
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
- Message includes Base destination address

### Step 3: Circle Attestation
- Poll Circle's Iris API for attestation
- Typically takes 2-3 minutes
- Attestation authorizes mint on destination

### Step 4: CCTP Mint on Base
- Submit message + attestation to Base CCTP MessageTransmitter contract
- USDC minted to user's Base wallet
- Transaction signed with Turnkey EVM wallet

### Step 5: Coinflow Withdrawal
- Coinflow widget appears after successful mint
- User can withdraw USDC to linked bank account
- Choose speed: Standard (2-3 days), Same Day, or ASAP
- Supports gasless withdrawals via EIP-712 permit signatures

## 🔧 Technical Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Coinflow React SDK**: Pre-built withdrawal widget

### Blockchain Integration
- **@cosmjs/stargate**: Cosmos chain interactions (Xion/Noble)
- **@turnkey/react-wallet-kit**: Passkey-based multi-chain wallets
- **@turnkey/ethers**: Turnkey integration with ethers.js
- **ethers.js v6**: Ethereum library for Base interactions
- **viem**: Modern TypeScript EVM library

### CCTP
- Noble CCTP Module (MsgDepositForBurn)
- Circle Iris API (attestation service)
- Base CCTP MessageTransmitter Contract

## 📁 Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Main CCTP flow UI
│   ├── providers.tsx       # Wallet providers setup
│   ├── globals.css         # Global styles
│   └── api/coinflow/       # Coinflow API routes
├── config/
│   ├── index.ts            # Chain configs (Xion, Noble, Base)
│   ├── networks/           # Network-specific configs
│   └── services/           # Service configs (Coinflow, CCTP)
├── types/
│   └── cctp.ts             # TypeScript types
├── utils/
│   ├── conversions.ts      # Amount & address conversions
│   ├── constants.ts        # Gas fees & timeouts
│   ├── apiHelpers.ts       # API validation & request builders
│   ├── ibc.ts              # IBC message builders
│   ├── cctp.ts             # Attestation fetching
│   ├── cctpNoble.ts        # Noble burn functions
│   ├── cctpBase.ts         # Base mint functions
│   ├── turnkeyBase.ts      # Turnkey Base integration
│   ├── turnkeyEIP712.ts    # EIP-712 signing with Turnkey
│   └── coinflowApi.ts      # Coinflow API helpers
├── hooks/
│   ├── useWalletClients.ts # Wallet client initialization
│   ├── useBalances.ts      # Balance polling
│   ├── useCCTPTransfer.ts  # CCTP transfer orchestration
│   ├── useCoinflowSession.ts # Coinflow session management
│   └── useWithdrawal.ts    # Withdrawal operations
├── components/             # React UI components
└── proto/                  # Noble CCTP protobuf types
```

## 🐛 Troubleshooting

### Wallet Connection Issues
- **Turnkey**: Ensure TURNKEY_ORG_ID is correctly set
- **Passkey**: Clear browser cache if authentication fails

### CCTP Transfer Failures
- **Noble Burn**: Check USDC balance on Noble
- **Attestation Timeout**: Circle API may be slow, wait up to 5 minutes
- **Base Mint**: Ensure Turnkey wallet has ETH for gas fees on Base

### Coinflow Issues
- **Widget Not Showing**: Verify USDC arrived on Base
- **Bank Linking**: Use Coinflow's sandbox environment for testing
- **Gasless Withdrawal**: Ensure EIP-712 signatures are working correctly

## 📚 Resources

- [Circle CCTP Docs](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [Base CCTP Contracts](https://developers.circle.com/stablecoins/docs/cctp-technical-reference)
- [Coinflow Documentation](https://docs.coinflow.cash)
- [Turnkey Docs](https://docs.turnkey.com)
- [Base Network](https://base.org)

## 🔐 Security Considerations

- Never commit `.env.local` to version control
- API keys should be server-side only
- Turnkey provides passkey-based security (no seed phrases)
- Coinflow handles PII securely in their widget
- EIP-712 signatures are validated on-chain

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## ⚠️ Disclaimer

This is a demo application for educational purposes. Test thoroughly before using in production.
