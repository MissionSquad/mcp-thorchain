/**
 * THORChain API Client with automatic provider rotation
 * Implements robust failover between Nine Realms and Liquify providers
 */

import type {
  MidgardActionsResponse,
  PoolsResponse,
  PoolDetailResponse,
  NetworkStats,
  InboundAddressesResponse,
} from "./types.js"

/**
 * Available API providers with primary and fallback endpoints
 */
const MIDGARD_PROVIDERS = [
  "https://midgard.ninerealms.com", // Primary
  "https://midgard.thorchain.liquify.com", // Fallback
]

const THORNODE_PROVIDERS = [
  "https://thornode.ninerealms.com", // Primary
  "https://thornode.thorchain.liquify.com", // Fallback
]

/**
 * Request timeout in milliseconds (5 seconds)
 */
const REQUEST_TIMEOUT = 5000

/**
 * Custom error class for THORChain API errors
 */
export class THORChainAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message)
    this.name = "THORChainAPIError"
  }
}

/**
 * Fetches data from a URL with timeout and error handling
 *
 * @param url - The full URL to fetch
 * @param timeoutMs - Timeout in milliseconds
 * @returns Parsed JSON response
 * @throws THORChainAPIError if fetch fails or times out
 */
async function fetchWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new THORChainAPIError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        url
      )
    }

    return (await response.json()) as T
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof THORChainAPIError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new THORChainAPIError(`Request timeout after ${timeoutMs}ms`, undefined, url)
      }
      throw new THORChainAPIError(`Network error: ${error.message}`, undefined, url)
    }

    throw new THORChainAPIError("Unknown error occurred", undefined, url)
  }
}

/**
 * Attempts to fetch from multiple providers with automatic failover
 *
 * @param providers - Array of base URLs to try
 * @param path - API path to append to base URL
 * @returns Parsed JSON response from first successful provider
 * @throws THORChainAPIError if all providers fail
 */
async function fetchWithRotation<T>(providers: string[], path: string): Promise<T> {
  const errors: string[] = []

  for (const baseUrl of providers) {
    const url = `${baseUrl}${path}`
    console.error(`[THORChain API] Trying ${baseUrl}...`)

    try {
      const data = await fetchWithTimeout<T>(url, REQUEST_TIMEOUT)
      console.error(`[THORChain API] Success: ${baseUrl}`)
      return data
    } catch (error) {
      const errorMsg =
        error instanceof THORChainAPIError
          ? `${baseUrl}: ${error.message}`
          : `${baseUrl}: ${String(error)}`
      errors.push(errorMsg)
      console.error(`[THORChain API] Failed: ${errorMsg}`)
    }
  }

  throw new THORChainAPIError(
    `All providers failed for ${path}. Errors: ${errors.join("; ")}`
  )
}

/**
 * Fetches transaction/action details by transaction ID
 *
 * @param txid - Transaction hash to lookup
 * @returns Action details or null if not found
 */
export async function getTransaction(txid: string): Promise<MidgardActionsResponse> {
  const path = `/v2/actions?txid=${encodeURIComponent(txid)}`
  return fetchWithRotation<MidgardActionsResponse>(MIDGARD_PROVIDERS, path)
}

/**
 * Fetches transaction history for a specific address
 *
 * @param address - Blockchain address to query
 * @param limit - Maximum number of actions to return (default: 10)
 * @param offset - Pagination offset (default: 0)
 * @returns Actions for the address
 */
export async function getAddressHistory(
  address: string,
  limit = 10,
  offset = 0
): Promise<MidgardActionsResponse> {
  const path = `/v2/actions?address=${encodeURIComponent(address)}&limit=${limit}&offset=${offset}`
  return fetchWithRotation<MidgardActionsResponse>(MIDGARD_PROVIDERS, path)
}

/**
 * Fetches current pool statistics
 *
 * @param period - Time period for stats (e.g., "24h", "7d", "30d")
 * @returns Pool statistics
 */
export async function getPools(period = "24h"): Promise<PoolsResponse> {
  const path = `/v2/pools?period=${encodeURIComponent(period)}`
  return fetchWithRotation<PoolsResponse>(MIDGARD_PROVIDERS, path)
}

/**
 * Fetches detailed statistics for a specific pool
 *
 * @param asset - Pool asset identifier (e.g., "BTC.BTC", "ETH.ETH")
 * @returns Detailed pool information
 */
export async function getPoolDetail(asset: string): Promise<PoolDetailResponse> {
  const path = `/v2/pool/${encodeURIComponent(asset)}`
  return fetchWithRotation<PoolDetailResponse>(MIDGARD_PROVIDERS, path)
}

/**
 * Fetches network-wide statistics
 *
 * @returns Network statistics including volume, swaps, and user counts
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  const path = "/v2/stats"
  return fetchWithRotation<NetworkStats>(MIDGARD_PROVIDERS, path)
}

/**
 * Fetches inbound vault addresses for depositing funds
 *
 * @returns Current inbound addresses for all supported chains
 */
export async function getInboundAddresses(): Promise<InboundAddressesResponse> {
  const path = "/thorchain/inbound_addresses"
  return fetchWithRotation<InboundAddressesResponse>(THORNODE_PROVIDERS, path)
}
