# x402 Payment Marketplace

A decentralized API marketplace built on Cronos blockchain using the x402 payment protocol. Enables developers to monetize APIs with cryptocurrency payments and supports AI agent integration.

**Hackathon**: [Cronos x402 Paytech Hackathon](https://dorahacks.io/hackathon/cronos-x402/detail)

---

## Quick Links

- **[Product Requirements Document](docs/prd/README.md)** - Start here for project overview
- **[Technical Stack](docs/prd/technical-stack.md)** - Complete tech stack including SIWE
- **[Research Findings](docs/prd/research-findings.md)** - x402, Cronos, and blockchain research
- **[Security Guidelines](docs/prd/security.md)** - Security requirements
- **[Development Workflow](docs/prd/development-workflow.md)** - Git, testing, deployment

---

## Features (Priority Order)

### Priority 1-3: MVP (Must Have)
1. **[x402 Proxy](docs/features/feature-1-proxy.md)** - Create payment-gated API endpoints
2. **[Payment Signing & SIWE Auth](docs/features/feature-2-payments.md)** - Wallet authentication and payments
3. **[API Marketplace](docs/features/feature-3-marketplace.md)** - Discover and test public APIs

### Priority 4-5: Extended Features
4. **[Payment Splitting](docs/features/feature-4-payment-splitting.md)** - Multi-party revenue sharing (ERC-1167)
5. **[MCP Server](docs/features/feature-5-mcp-server.md)** - AI agent integration via Model Context Protocol

### Priority 6-7: Stretch Goals
6. **[AI Chat Interface](docs/features/feature-6-ai-chat.md)** - Built-in AI chat with API tools
7. **[AI Agent Wallet](docs/features/feature-7-agent-wallet.md)** - Autonomous AI wallet (ERC-4337)

---

## Technology Stack

### Frontend
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- wagmi + viem (blockchain)
- SIWE (authentication)
- @x402/* packages (payments)

### Backend
- Next.js API routes
- PostgreSQL + Drizzle ORM
- iron-session (encrypted sessions)

### Smart Contracts
- Hardhat
- OpenZeppelin
- Solidity 0.8.24+

### Blockchain
- Cronos testnet (Chain ID: 338)
- Cronos mainnet (Chain ID: 25)

---

## Project Structure

```
x402-hackathon/
├── docs/
│   ├── prd/              # Planning documents
│   └── features/         # Feature specifications
├── src/
│   ├── app/              # Next.js app
│   ├── components/       # React components
│   ├── lib/              # Utilities & integrations
│   └── types/            # TypeScript types
├── contracts/            # Smart contracts (Hardhat)
├── mcp-server/           # MCP server (Priority 5)
└── public/               # Static assets
```

---

## Getting Started (For Implementation Agents)

### When Assigned a Feature:

1. **Read the feature spec**: `docs/features/feature-X-[name].md`
2. **Review tech stack**: `docs/prd/technical-stack.md`
3. **Check security**: `docs/prd/security.md`
4. **Propose implementation plan** to user for approval
5. **Implement** with clean, tested code
6. **Verify** against "Definition of Done" in feature spec

### Development Principles:

- ✅ One vertical slice at a time
- ✅ Always get user approval before coding
- ✅ Write clean, well-architected code
- ✅ Security first
- ✅ Follow TypeScript strict mode

---

## Key Concepts

### x402 Protocol
HTTP-based payment protocol using 402 status code for blockchain payments. Server returns 402 with payment details, client signs payment, retries request with signature.

### SIWE (Sign-In with Ethereum)
Password-less authentication using wallet signatures (EIP-4361). Users sign a message to prove wallet ownership.

### Cronos x402 Facilitator
Third-party service that verifies x402 payments and handles gasless USDC transfers on Cronos using EIP-3009.

### Zero-Knowledge Encryption
User credentials encrypted with key derived from wallet signature. Only the user who can sign with their wallet can decrypt.

---

## Success Metrics

### MVP
- [ ] User can authenticate with SIWE
- [ ] User can create payment-gated API proxy
- [ ] Consumer can pay and access API
- [ ] Marketplace shows public APIs

### Extended
- [ ] Payment splitting on Cronos testnet
- [ ] MCP server integration working

### Stretch
- [ ] AI chat with x402 payments
- [ ] Agent wallet functional

---

## Documentation Organization

### For Planning
- Start with `docs/prd/README.md` for overview
- Review research findings for technical background
- Understand development workflow

### For Implementation
- Each feature has its own spec in `docs/features/`
- Specs include user stories, technical requirements, UI components, and definition of done
- Reference technical stack and security docs as needed

---

## Environment Setup

```bash
# Install dependencies
npm install

# Setup database (Docker)
docker run --name x402-postgres \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=x402_marketplace \
  -p 5432:5432 \
  -d postgres:15

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Run migrations
npm run db:migrate

# Start dev server
npm run dev
```

---

## Resources

### Official Documentation
- [x402 Specification](https://github.com/coinbase/x402)
- [Coinbase x402 Docs](https://docs.cdp.coinbase.com/x402/welcome)
- [Cronos x402 Facilitator](https://docs.cronos.org/cronos-x402-facilitator/introduction)
- [Cronos Developer Docs](https://docs.cronos.org/)
- [SIWE Documentation](https://docs.login.xyz/)

### Community
- Cronos Discord
- Hackathon page: https://dorahacks.io/hackathon/cronos-x402/detail

---

## License

MIT (or as required by hackathon)

---

**Status**: Planning Complete - Ready for Implementation
**Last Updated**: 2025-12-12
