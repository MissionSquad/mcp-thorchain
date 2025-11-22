# mcp-thorchain

A Model Context Protocol (MCP) server providing access to THORChain blockchain data. This server enables AI assistants like Claude to query THORChain transactions, pools, network statistics, and vault addresses through a standardized interface.

## Features

- **Transaction Lookup**: Get detailed information about specific THORChain transactions
- **Address History**: Query transaction history for any blockchain address
- **Pool Statistics**: Access liquidity pool data including prices, APY, and trading volume
- **Pool Details**: Get in-depth information for specific liquidity pools
- **Network Stats**: Retrieve network-wide statistics including swap volumes and active users
- **Vault Addresses**: Get current inbound addresses for depositing funds to THORChain

## Requirements

- Node.js >= 20.0.0
- npm or compatible package manager

## Installation

```bash
# Clone the repository
git clone https://github.com/MissionSquad/mcp-thorchain.git
cd mcp-thorchain

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Claude Desktop

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "thorchain": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-thorchain/dist/index.js"
      ]
    }
  }
}
```

Replace `/absolute/path/to/mcp-thorchain` with the actual path to your installation directory.

After adding the configuration:
1. Completely quit Claude Desktop (Cmd+Q on macOS, or via System Tray on Windows)
2. Reopen Claude Desktop
3. The THORChain tools should now be available

### Testing with MCP Inspector

You can test the server without Claude Desktop using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This will open a web interface (usually at `http://localhost:5173`) where you can:
- View all available tools
- Test tool execution with custom parameters
- See request/response data
- Debug server behavior

## Available Tools

### 1. `get-transaction`

Get detailed information about a specific THORChain transaction.

**Parameters:**
- `txid` (string, required): Transaction hash (64-character hexadecimal string)

**Example:**
```typescript
{
  "txid": "DC85CB537CB6082F61270D70C4058BB111475BCDC403E6E42AAF2106D067E1B4"
}
```

### 2. `get-address-history`

Retrieve transaction history for a blockchain address.

**Parameters:**
- `address` (string, required): Blockchain address to query
- `limit` (number, optional): Maximum transactions to return (default: 10, max: 50)
- `offset` (number, optional): Pagination offset (default: 0)

**Example:**
```typescript
{
  "address": "thor1...",
  "limit": 20,
  "offset": 0
}
```

### 3. `get-pools`

Get statistics for all THORChain liquidity pools.

**Parameters:**
- `period` (enum, optional): Time period - "1h" | "24h" | "7d" | "30d" | "90d" | "365d" | "all" (default: "24h")

**Example:**
```typescript
{
  "period": "24h"
}
```

### 4. `get-pool-detail`

Get detailed information for a specific liquidity pool.

**Parameters:**
- `asset` (string, required): Pool asset identifier (e.g., "BTC.BTC", "ETH.ETH")

**Example:**
```typescript
{
  "asset": "BTC.BTC"
}
```

### 5. `get-network-stats`

Get overall THORChain network statistics.

**Parameters:** None

### 6. `get-vault-addresses`

Get current THORChain vault addresses for depositing funds.

**Parameters:** None

## API Providers

The server automatically rotates between multiple API providers for redundancy:

**Primary**: Nine Realms (`https://midgard.ninerealms.com`, `https://thornode.ninerealms.com`)
**Fallback**: Liquify (`https://midgard.thorchain.liquify.com`, `https://thornode.thorchain.liquify.com`)

If the primary provider fails or times out, the server automatically tries the fallback provider.

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Project Structure

```
mcp-thorchain/
├── src/
│   ├── index.ts           # MCP server and tool definitions
│   ├── api-client.ts      # THORChain API client with provider rotation
│   └── types.ts           # TypeScript type definitions
├── dist/                  # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## Technical Details

### Dependencies

- `@modelcontextprotocol/sdk@1.22.0`: MCP server SDK
- `zod@3.23.8`: Schema validation

### Type Safety

The project uses TypeScript with strict mode enabled. Due to a known incompatibility between Zod v3.23.8 (bundled with the MCP SDK) and TypeScript's type inference, the main server file uses `@ts-nocheck`. Runtime validation and type safety are maintained through Zod schemas.

### Error Handling

- All API requests include 5-second timeouts
- Automatic provider failover on connection errors
- Comprehensive error messages with context
- Custom `THORChainAPIError` class for API-specific errors

## Troubleshooting

### Tools Not Appearing in Claude

1. Verify the path in `claude_desktop_config.json` is absolute and correct
2. Ensure the project is built (`npm run build`)
3. Completely quit and restart Claude Desktop
4. Check Claude's logs:
   - macOS: `~/Library/Logs/Claude/mcp-server-thorchain.log`
   - Windows: `%APPDATA%\Claude\logs`

### Build Errors

If you encounter build errors after updating dependencies:

```bash
# Clean and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

### Connection Timeouts

The server has a 5-second timeout for each API request. If you're experiencing frequent timeouts:

1. Check your internet connection
2. Verify the API providers are operational
3. The server will automatically try the fallback provider

## API Reference

For detailed THORChain API documentation, see the [THORChain API Handbook](https://dev.thorchain.org/).

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [THORChain Documentation](https://docs.thorchain.org/)
- [Nine Realms API](https://midgard.ninerealms.com)
