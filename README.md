# Backend Service Architecture

NestJS backend service for the bonding system, handling API endpoints, blockchain event processing, and database operations.

## Service Components

### 1) Token Service (`src/token/`)

**Responsibilities:**
- Token creation and metadata management
- Buy/sell transaction processing
- Price calculation and market data
- Token listing and search functionality

**Key Endpoints:**
- `POST /tokens` - Create new token
- `GET /tokens` - List tokens with pagination/filtering
- `GET /tokens/:address` - Get token details
- `POST /tokens/:address/buy` - Execute buy transaction
- `POST /tokens/:address/sell` - Execute sell transaction
- `GET /tokens/:address/price` - Get current price data
- `GET /tokens/:address/chart` - Get price chart data

### 2) Event Processing Service (`src/token/token.event.service.ts`)

**Responsibilities:**
- Listen to smart contract events (`TokenCreated`, `Buy`, `Sell`, `DexListing`)
- Process and store transaction data
- Update token statistics and market data
- Handle real-time price updates

**Event Flow:**
1. Contract emits event (TokenCreated, Buy, Sell, DexListing)
2. Event service captures via Web3 provider
3. Parse event data and validate
4. Update database records (tokens, transactions, prices)
5. Emit real-time updates via WebSocket/SSE

### 3) Database Schema

**Tokens Table:**
- `address` (primary key)
- `name`, `symbol`, `description`
- `creator`, `totalSupply`
- `bondingCurve`, `raiseToken`
- `imageUrl`, `twitter`, `telegram`, `website`
- `currentPrice`, `marketCap`, `volume24h`
- `isDexListed`, `createdAt`

**Transactions Table:**
- `id` (primary key)
- `tokenAddress`, `userAddress`
- `type` (buy/sell), `amount`, `price`
- `txHash`, `blockNumber`, `timestamp`

**Price History Table:**
- `tokenAddress`, `timestamp`
- `price`, `volume`, `marketCap`
- Indexed for efficient chart queries

### 4) Real-time Data Flow

**WebSocket Events:**
- `token:created` - New token launched
- `token:buy` - Buy transaction processed
- `token:sell` - Sell transaction processed
- `token:price_update` - Price changed
- `token:dex_listed` - Token graduated to DEX

**Price Update Strategy:**
- Real-time: Process contract events immediately
- Batch: Aggregate price history every minute
- Cache: Redis for frequently accessed price data

### 5) API Integration Patterns

**Frontend Integration:**
```typescript
// Token creation flow
POST /tokens
{
  name, symbol, description,
  imageUrl, twitter, telegram, website,
  targetValue, raiseToken
}

// Buy flow
POST /tokens/:address/buy
{
  amount: "0.1",        // BNB amount
  minTokens: "1000",    // Slippage protection
  wallet: "0x..."       // User wallet
}

// Real-time price subscription
WebSocket: subscribe("token:price_update", tokenAddress)
```

**Blockchain Integration:**
- Web3 provider for contract interaction
- Event listener with block confirmation handling
- Transaction retry logic with gas optimization
- Multi-node failover for reliability

### 6) Caching Strategy

**Redis Cache Layers:**
- Token metadata (1 hour TTL)
- Current prices (30 seconds TTL)
- Chart data (5 minutes TTL)
- User transaction history (10 minutes TTL)

**Database Optimization:**
- Indexed queries on `tokenAddress`, `timestamp`
- Read replicas for chart/analytics queries
- Connection pooling for high throughput

### 7) Error Handling and Monitoring

**Error Categories:**
- Blockchain connectivity issues
- Transaction failures (insufficient gas, slippage)
- Database connection problems
- Rate limiting and DDoS protection

**Monitoring Metrics:**
- API response times
- Event processing lag
- Database query performance
- WebSocket connection count
- Contract interaction success rate

## Development Setup

```bash
# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Configure: DATABASE_URL, REDIS_URL, WEB3_RPC_URL

# Database migration
npm run migration:run

# Start development server
npm run start:dev

# Run tests
npm run test
npm run test:e2e
```

## Production Deployment

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis cache connection  
- `WEB3_RPC_URL` - Blockchain RPC endpoint
- `CONTRACT_ADDRESSES` - Factory and deployer addresses
- `JWT_SECRET` - Authentication secret

**Scaling Considerations:**
- Horizontal scaling with load balancer
- Separate event processing workers
- Database read replicas
- CDN for static assets (token images)
