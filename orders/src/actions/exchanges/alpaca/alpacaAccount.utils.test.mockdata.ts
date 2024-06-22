import {
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  ALPACA_LIVE_TRADING_ENDPOINT,
  ALPACA_PAPER_TRADING_ACCOUNT_NAME,
} from "./alpaca.constants";
import { type AlpacaAccountCredentials } from "./alpaca.types";
import { type AlpacaApiGetPosition } from "./alpacaApi.types";

export const MOCK_ALPACA_ACCOUNTS: Record<string, AlpacaAccountCredentials> = {
  [ALPACA_LIVE_TRADING_ACCOUNT_NAME]: {
    endpoint: "mockLiveEndpoint",
    key: "mockLiveKey",
    secret: "mockLiveSecret",
    paper: false,
  },
  [ALPACA_PAPER_TRADING_ACCOUNT_NAME]: {
    endpoint: "mockPaperEndpoint",
    key: "mockPaperKey",
    secret: "mockPaperSecret",
    paper: true,
  },
};

export const mockCredentials: AlpacaAccountCredentials = {
  endpoint: ALPACA_LIVE_TRADING_ENDPOINT,
  key: "mockKey",
  secret: "mockSecret",
  paper: true,
};

export const mockPositionDetails: AlpacaApiGetPosition = {
  position: "mockPosition",
  qty: "100.5",
  market_value: "15000.75",
};
