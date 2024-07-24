import Decimal from "decimal.js";
import { type AlpacaAccountCredentials } from "./alpaca.types";

export const ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE: Decimal = new Decimal(
  1,
);

export const ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE: Decimal = new Decimal(
  0.005,
);

export const ALPACA_LIVE_TRADING_ACCOUNT_NAME = "alpacaTradingAccountNameLive";

export const ALPACA_LIVE_TRADING_ENDPOINT = "https://api.alpaca.markets";

export const ALPACA_PAPER_TRADING_ACCOUNT_NAME =
  "alpacaTradingAccountNamePaper";

export const ALPACA_PAPER_TRADING_ENDPOINT = "https://paper-api.alpaca.markets";

export const ALPACA_ACCOUNTS: Record<string, AlpacaAccountCredentials> = {
  [ALPACA_LIVE_TRADING_ACCOUNT_NAME]: {
    endpoint: ALPACA_LIVE_TRADING_ENDPOINT,
    key: process.env.ALPACA_LIVE_KEY ?? "",
    secret: process.env.ALPACA_LIVE_SECRET ?? "",
    paper: false,
  },
  [ALPACA_PAPER_TRADING_ACCOUNT_NAME]: {
    endpoint: ALPACA_PAPER_TRADING_ENDPOINT,
    key: process.env.ALPACA_PAPER_KEY ?? "",
    secret: process.env.ALPACA_PAPER_SECRET ?? "",
    paper: true,
  },
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const ALPACA_TRADINGVIEW_SYMBOLS: Record<string, string> = JSON.parse(
  process.env.ALPACA_TRADINGVIEW_SYMBOLS ?? "{}",
);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const ALPACA_TRADINGVIEW_INVERSE_PAIRS: Record<string, string> =
  JSON.parse(process.env.ALPACA_TRADINGVIEW_INVERSE_PAIRS ?? "{}");
