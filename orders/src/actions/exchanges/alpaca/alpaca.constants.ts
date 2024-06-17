import { type AlpacaAccountCredentials } from "./alpaca.types";

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
