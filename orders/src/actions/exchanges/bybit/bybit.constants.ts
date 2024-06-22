import { type BybitAccountCredentials } from "./bybit.types";

export const BYBIT_LIVE_TRADING_ACCOUNT_NAME = "live";

export const BYBIT_PAPER_TRADING_ACCOUNT_NAME = "paper";

export const BYBIT_ACCOUNTS: Record<string, BybitAccountCredentials> = {
  [BYBIT_LIVE_TRADING_ACCOUNT_NAME]: {
    key: process.env.BYBIT_LIVE_KEY ?? "",
    secret: process.env.BYBIT_LIVE_SECRET ?? "",
    testnet: false,
  },
  [BYBIT_PAPER_TRADING_ACCOUNT_NAME]: {
    key: process.env.BYBIT_PAPER_KEY ?? "",
    secret: process.env.BYBIT_PAPER_SECRET ?? "",
    testnet: true,
  },
};

export const BYBIT_PREFERRED_STABLECOIN = "USDT";

export const BYBIT_TAX_PAIR = "USDC-USDT";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const tradingviewBybitSymbols: Record<string, string> = JSON.parse(
  process.env.BYBIT_TRADINGVIEW_SYMBOLS ?? "{}",
);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const tradingviewBybitInverseSymbols: Record<string, string> =
  JSON.parse(process.env.BYBIT_TRADINGVIEW_INVERSE_PAIRS ?? "{}");
