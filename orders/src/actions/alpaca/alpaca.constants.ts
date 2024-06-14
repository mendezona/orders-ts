import { type AlpacaAccountCredentials } from "./alpaca.types";

export const ALPACA_TRADING_ACCOUNT_NAME_LIVE = "alpacaTradingAccountNameLive";

export const ALPACA_TRADING_ACCOUNT_NAME_PAPER =
  "alpacaTradingAccountNamePaper";

export const ALPACA_ACCOUNTS: Record<string, AlpacaAccountCredentials> = {
  [ALPACA_TRADING_ACCOUNT_NAME_LIVE]: {
    endpoint: "https://api.alpaca.markets",
    key: process.env.ALPACA_LIVE_KEY ?? "",
    secret: process.env.ALPACA_LIVE_SECRET ?? "",
    paper: false,
  },
  [ALPACA_TRADING_ACCOUNT_NAME_PAPER]: {
    endpoint: "https://paper-api.alpaca.markets",
    key: process.env.ALPACA_PAPER_KEY ?? "",
    secret: process.env.ALPACA_PAPER_SECRET ?? "",
    paper: true,
  },
};
