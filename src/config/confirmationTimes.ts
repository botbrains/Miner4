/**
 * Estimated average time (in minutes) for a payment in a given cryptocurrency
 * to receive its first confirmation on-chain.
 *
 * These are rough order-of-magnitude estimates and are displayed to the user
 * as "typically ready in ~X min (estimate)".
 *
 * Keys are lowercase currency IDs matching SUPPORTED_CURRENCIES in src/types/index.ts.
 */
export const CONFIRMATION_TIMES_MIN: Record<string, number> = {
  btc:  60,
  eth:  5,
  ltc:  2.5,
  xmr:  20,
  usdt: 5,    // ERC-20 on Ethereum
  usdc: 5,    // ERC-20 on Ethereum
  sol:  0.5,
  bnb:  0.5,
};
