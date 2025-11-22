#!/usr/bin/env node
/**
 * THORChain MCP Server
 * Provides tools for accessing THORChain blockchain data via the Model Context Protocol
 *
 * Version: 1.0.0
 * Dependencies:
 * - @modelcontextprotocol/sdk: 1.22.0
 * - zod: 3.23.8
 *
 * Note: Type assertions (as any) on inputSchema are necessary due to a known issue
 * with Zod version compatibility in the MCP SDK. TypeScript sees our Zod instance
 * and the SDK's bundled Zod as incompatible types, even though they're the same version.
 * See: https://github.com/modelcontextprotocol/typescript-sdk/issues/891
 * Runtime validation remains intact and type-safe.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  getTransaction,
  getAddressHistory,
  getPools,
  getPoolDetail,
  getNetworkStats,
  getInboundAddresses,
  THORChainAPIError,
} from "./api-client.js"

/**
 * Initialize the MCP Server
 */
const server = new McpServer({
  name: "thorchain-server",
  version: "1.0.0",
})

/**
 * Tool: get-transaction
 * Fetches detailed information about a specific THORChain transaction
 */
server.registerTool(
  "get-transaction",
  {
    title: "Get Transaction",
    description: "Get detailed information about a THORChain transaction by its transaction ID (hash)",
    inputSchema: {
      txid: z
        .string()
        .min(64)
        .max(64)
        .describe("Transaction hash (64-character hexadecimal string)"),
    } as any,
  },
  async (args: any) => {
    const { txid } = args
    try {
      const response = await getTransaction(txid)

      if (!response.actions || response.actions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Transaction ${txid} not found or is pending confirmation.`,
            },
          ],
        }
      }

      const action = response.actions[0]
      const date = new Date(parseInt(action.date) / 1000000).toISOString()

      // Format input assets
      const inputAssets = action.in
        .map(
          (transfer) =>
            transfer.coins.map((coin) => `${coin.amount} ${coin.asset}`).join(", ") +
            ` from ${transfer.address}`
        )
        .join("; ")

      // Format output assets
      const outputAssets = action.out
        .map(
          (transfer) =>
            transfer.coins.map((coin) => `${coin.amount} ${coin.asset}`).join(", ") +
            ` to ${transfer.address}`
        )
        .join("; ")

      // Extract fee information if available
      let feeInfo = ""
      if (action.metadata?.swap) {
        const swap = action.metadata.swap
        feeInfo = `\nLiquidity Fee: ${swap.liquidityFee}\nSlip: ${swap.swapSlip}%`
        if (swap.networkFees && swap.networkFees.length > 0) {
          feeInfo += `\nNetwork Fees: ${swap.networkFees.map((f) => `${f.amount} ${f.asset}`).join(", ")}`
        }
      }

      const result = `Transaction: ${txid}
Type: ${action.type}
Status: ${action.status}
Date: ${date}
Block Height: ${action.height}
Pools: ${action.pools.join(", ") || "N/A"}

Input: ${inputAssets}
Output: ${outputAssets}${feeInfo}`

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      }
    } catch (error) {
      if (error instanceof THORChainAPIError) {
        throw new Error(`THORChain API Error: ${error.message}`)
      }
      throw error
    }
  }
)

/**
 * Tool: get-address-history
 * Fetches transaction history for a specific blockchain address
 */
server.registerTool(
  "get-address-history",
  {
    title: "Get Address History",
    description: "Get transaction history for a specific address across all THORChain-supported chains",
    inputSchema: {
      address: z.string().min(1).describe("Blockchain address to query"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of transactions to return (default: 10, max: 50)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Pagination offset (default: 0)"),
    } as any,
  },
  async (args: any) => {
    const { address, limit = 10, offset = 0 } = args
    try {
      const response = await getAddressHistory(address, limit, offset)

      if (!response.actions || response.actions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No transactions found for address ${address}.`,
            },
          ],
        }
      }

      const transactions = response.actions.map((action, index) => {
        const date = new Date(parseInt(action.date) / 1000000).toISOString()
        const txid = action.in[0]?.txID || action.out[0]?.txID || "unknown"

        return `${offset + index + 1}. ${action.type} - ${action.status}
   Date: ${date}
   TxID: ${txid}
   Height: ${action.height}`
      })

      const result = `Transaction History for ${address}
Total Count: ${response.count}
Showing: ${offset + 1}-${offset + response.actions.length}

${transactions.join("\n\n")}

${response.meta.nextPageToken ? `More results available. Use offset=${offset + limit} to see next page.` : "End of results."}`

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      }
    } catch (error) {
      if (error instanceof THORChainAPIError) {
        throw new Error(`THORChain API Error: ${error.message}`)
      }
      throw error
    }
  }
)

/**
 * Tool: get-pools
 * Fetches current pool statistics and liquidity information
 */
server.registerTool(
  "get-pools",
  {
    title: "Get Pools",
    description: "Get statistics for all THORChain liquidity pools including prices, APY, and volume",
    inputSchema: {
      period: z
        .enum(["1h", "24h", "7d", "30d", "90d", "365d", "all"])
        .optional()
        .describe("Time period for statistics (default: 24h)"),
    } as any,
  },
  async (args: any) => {
    const { period = "24h" } = args
    try {
      const response = await getPools(period)

      if (!response.pools || response.pools.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No pools data available.",
            },
          ],
        }
      }

      // Sort pools by 24h volume descending
      const sortedPools = response.pools
        .filter((p) => p.status === "available")
        .sort((a, b) => parseInt(b.volume24h) - parseInt(a.volume24h))
        .slice(0, 20) // Top 20 pools

      const poolsList = sortedPools.map((pool, index) => {
        const volume24h = (parseInt(pool.volume24h) / 1e8).toFixed(2)
        const priceUSD = parseFloat(pool.assetPriceUSD).toFixed(6)
        const apy = parseFloat(pool.poolAPY).toFixed(2)

        return `${index + 1}. ${pool.asset}
   Price: $${priceUSD}
   APY: ${apy}%
   24h Volume: ${volume24h} RUNE
   Status: ${pool.status}`
      })

      const result = `THORChain Liquidity Pools (${period})
Total Pools: ${response.pools.length}
Active Pools: ${sortedPools.length}

Top 20 by Volume:
${poolsList.join("\n\n")}`

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      }
    } catch (error) {
      if (error instanceof THORChainAPIError) {
        throw new Error(`THORChain API Error: ${error.message}`)
      }
      throw error
    }
  }
)

/**
 * Tool: get-pool-detail
 * Fetches detailed information for a specific liquidity pool
 */
server.registerTool(
  "get-pool-detail",
  {
    title: "Get Pool Detail",
    description: "Get detailed statistics and information for a specific THORChain liquidity pool",
    inputSchema: {
      asset: z
        .string()
        .min(1)
        .describe("Pool asset identifier (e.g., BTC.BTC, ETH.ETH, ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48)"),
    } as any,
  },
  async (args: any) => {
    const { asset } = args
    try {
      const pool = await getPoolDetail(asset)

      const assetDepth = (parseInt(pool.assetDepth) / 1e8).toFixed(4)
      const runeDepth = (parseInt(pool.runeDepth) / 1e8).toFixed(4)
      const priceUSD = parseFloat(pool.assetPriceUSD).toFixed(6)
      const apy = parseFloat(pool.poolAPY).toFixed(2)
      const volume24h = (parseInt(pool.volume24h) / 1e8).toFixed(2)

      const result = `Pool Details: ${pool.asset}

Price & Liquidity:
- Asset Price (RUNE): ${pool.assetPrice}
- Asset Price (USD): $${priceUSD}
- Asset Depth: ${assetDepth}
- RUNE Depth: ${runeDepth}
- Liquidity Units: ${pool.liquidityUnits}

Yield:
- Pool APY: ${apy}%
- Annual Percentage Rate: ${pool.annualPercentageRate}%
- Savers APR: ${pool.saversAPR}%

Activity:
- 24h Volume: ${volume24h} RUNE
- Status: ${pool.status}
- Savers Depth: ${pool.saversDepth}`

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      }
    } catch (error) {
      if (error instanceof THORChainAPIError) {
        throw new Error(`THORChain API Error: ${error.message}`)
      }
      throw error
    }
  }
)

/**
 * Tool: get-network-stats
 * Fetches network-wide statistics
 */
server.registerTool(
  "get-network-stats",
  {
    title: "Get Network Stats",
    description: "Get overall THORChain network statistics including total volume, swap counts, and active users",
    inputSchema: {} as any,
  },
  async () => {
    try {
      const stats = await getNetworkStats()

      const swapVolume = (parseInt(stats.swapVolume) / 1e8).toFixed(2)
      const addLiquidityVolume = (parseInt(stats.addLiquidityVolume) / 1e8).toFixed(2)

      const result = `THORChain Network Statistics

Swap Activity:
- Total Swaps: ${stats.swapCount}
- Swaps (24h): ${stats.swapCount24h}
- Swaps (30d): ${stats.swapCount30d}
- Total Swap Volume: ${swapVolume} RUNE
- To Asset Swaps: ${stats.toAssetCount}
- To RUNE Swaps: ${stats.toRuneCount}

Liquidity:
- Add Liquidity Count: ${stats.addLiquidityCount}
- Add Liquidity Volume: ${addLiquidityVolume} RUNE

Users:
- Daily Active Users: ${stats.dailyActiveUsers}
- Monthly Active Users: ${stats.monthlyActiveUsers}
- Unique Swappers: ${stats.uniqueSwapperCount}`

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      }
    } catch (error) {
      if (error instanceof THORChainAPIError) {
        throw new Error(`THORChain API Error: ${error.message}`)
      }
      throw error
    }
  }
)

/**
 * Tool: get-vault-addresses
 * Fetches current inbound vault addresses for depositing funds
 */
server.registerTool(
  "get-vault-addresses",
  {
    title: "Get Vault Addresses",
    description: "Get current THORChain vault addresses for depositing funds to supported chains",
    inputSchema: {} as any,
  },
  async () => {
    try {
      const response = await getInboundAddresses()

      if (!response.current || response.current.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No inbound addresses available.",
            },
          ],
        }
      }

      const addresses = response.current.map((addr) => {
        const gasRate = addr.gas_rate ? `${addr.gas_rate} ${addr.gas_rate_units}` : "N/A"
        const status = addr.halted
          ? "HALTED"
          : addr.chain_trading_paused
            ? "TRADING PAUSED"
            : "ACTIVE"

        return `${addr.chain}:
  Address: ${addr.address}
  Status: ${status}
  Gas Rate: ${gasRate}
  Outbound Fee: ${addr.outbound_fee}
  ${addr.router ? `Router: ${addr.router}` : ""}`
      })

      const result = `THORChain Inbound Vault Addresses

${addresses.join("\n\n")}

Note: Always verify addresses are not halted before sending funds.`

      return {
        content: [
          {
            type: "text" as const,
            text: result,
          },
        ],
      }
    } catch (error) {
      if (error instanceof THORChainAPIError) {
        throw new Error(`THORChain API Error: ${error.message}`)
      }
      throw error
    }
  }
)

/**
 * Start the MCP server using stdio transport
 */
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("THORChain MCP Server started on stdio")
  console.error("Available tools:")
  console.error("  - get-transaction")
  console.error("  - get-address-history")
  console.error("  - get-pools")
  console.error("  - get-pool-detail")
  console.error("  - get-network-stats")
  console.error("  - get-vault-addresses")
}

main().catch((error) => {
  console.error("Fatal error in main():", error)
  process.exit(1)
})
