/**
 * Maps each supported mining algorithm to the coins that can be mined with it,
 * along with address format validation patterns.
 *
 * The `addressRe` is used at checkout to validate that the payout address
 * entered by the user is valid for the selected coin.
 */

export interface CoinConfig {
  coin: string;
  label: string;
  /** Regex to validate a payout address for this coin. */
  addressRe: RegExp;
}

export const ALGORITHM_COINS: Record<string, CoinConfig[]> = {
  'SHA-256': [
    {
      coin: 'BTC',
      label: 'Bitcoin (BTC)',
      // Legacy (P2PKH/P2SH) + native SegWit (bech32/bech32m)
      addressRe: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{6,87})$/,
    },
    {
      coin: 'BCH',
      label: 'Bitcoin Cash (BCH)',
      // CashAddr (with or without prefix) or legacy format
      addressRe: /^((bitcoincash:)?(q|p)[a-z0-9]{41}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
    },
  ],
  'Scrypt': [
    {
      coin: 'LTC',
      label: 'Litecoin (LTC)',
      addressRe: /^([LM3][a-km-zA-HJ-NP-Z1-9]{25,34}|ltc1[a-z0-9]{6,87})$/,
    },
  ],
  'Ethash': [
    {
      coin: 'ETC',
      label: 'Ethereum Classic (ETC)',
      addressRe: /^0x[a-fA-F0-9]{40}$/,
    },
  ],
  'X11': [
    {
      coin: 'DASH',
      label: 'Dash (DASH)',
      addressRe: /^X[a-km-zA-HJ-NP-Z1-9]{33}$/,
    },
  ],
  'RandomX': [
    {
      coin: 'XMR',
      label: 'Monero (XMR)',
      // Standard 95-char + integrated 106-char addresses
      addressRe: /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$|^8[0-9AB][1-9A-HJ-NP-Za-km-z]{104}$/,
    },
  ],
};
