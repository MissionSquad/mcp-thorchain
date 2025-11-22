/**
 * THORChain API Type Definitions
 * Based on Midgard v2 API and Thornode API specifications
 */

/**
 * Asset transfer information
 */
export interface AssetTransfer {
  coins: Array<{
    asset: string
    amount: string
  }>
  txID: string
  address: string
}

/**
 * Action metadata containing additional swap/action details
 */
export interface ActionMetadata {
  swap?: {
    liquidityFee: string
    networkFees: Array<{
      asset: string
      amount: string
    }>
    swapSlip: string
    swapTarget: string
  }
  refund?: {
    reason: string
    networkFees: Array<{
      asset: string
      amount: string
    }>
  }
}

/**
 * Midgard action (transaction) details
 */
export interface MidgardAction {
  type: string
  status: string
  date: string
  height: string
  pools: string[]
  in: AssetTransfer[]
  out: AssetTransfer[]
  metadata?: ActionMetadata
}

/**
 * Midgard actions API response
 */
export interface MidgardActionsResponse {
  actions: MidgardAction[]
  count: string
  meta: {
    nextPageToken: string
  }
}

/**
 * Pool statistics
 */
export interface PoolStats {
  asset: string
  assetDepth: string
  runeDepth: string
  assetPrice: string
  assetPriceUSD: string
  liquidityUnits: string
  poolAPY: string
  status: string
  volume24h: string
}

/**
 * Pools API response
 */
export interface PoolsResponse {
  pools: PoolStats[]
}

/**
 * Pool detail response
 */
export interface PoolDetailResponse extends PoolStats {
  annualPercentageRate: string
  saversAPR: string
  saversDepth: string
}

/**
 * Network statistics
 */
export interface NetworkStats {
  addLiquidityCount: string
  addLiquidityVolume: string
  swapCount: string
  swapCount24h: string
  swapCount30d: string
  swapVolume: string
  toAssetCount: string
  toRuneCount: string
  dailyActiveUsers: string
  monthlyActiveUsers: string
  uniqueSwapperCount: string
}

/**
 * Inbound address information for receiving funds
 */
export interface InboundAddress {
  chain: string
  pub_key: string
  address: string
  halted: boolean
  gas_rate: string
  gas_rate_units: string
  router?: string
  global_trading_paused: boolean
  chain_trading_paused: boolean
  chain_lp_actions_paused: boolean
  outbound_tx_size: string
  outbound_fee: string
}

/**
 * Thornode inbound addresses response
 */
export interface InboundAddressesResponse {
  current: InboundAddress[]
}
