import Decimal from "decimal.js";
import { type AlpacaAccountCredentials } from "./alpaca.types";

export const ALPACA_CAPITAL_TO_DEPLOY_EQUITY_PERCENTAGE: Decimal = new Decimal(
  1,
);

export const ALPACA_TOLERATED_EXTENDED_HOURS_SLIPPAGE: Decimal = new Decimal(
  0.02,
);

export const ALPACA_TRADING_ACCOUNT_NAME_LIVE = "alpacaTradingAccountNameLive";
export const ALPACA_TRADING_LIVE_ENDPOINT = "https://api.alpaca.markets";

export const ALPACA_TRADING_ACCOUNT_NAME_PAPER =
  "alpacaTradingAccountNamePaper";
export const ALPACA_TRADING_PAPER_ENDPOINT = "https://paper-api.alpaca.markets";

export const ALPACA_ACCOUNTS: Record<string, AlpacaAccountCredentials> = {
  [ALPACA_TRADING_ACCOUNT_NAME_LIVE]: {
    endpoint: ALPACA_TRADING_LIVE_ENDPOINT,
    key: process.env.ALPACA_LIVE_KEY ?? "",
    secret: process.env.ALPACA_LIVE_SECRET ?? "",
    paper: false,
  },
  [ALPACA_TRADING_ACCOUNT_NAME_PAPER]: {
    endpoint: ALPACA_TRADING_PAPER_ENDPOINT,
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
