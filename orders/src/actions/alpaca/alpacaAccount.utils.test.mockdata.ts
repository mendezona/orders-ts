import {
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  ALPACA_TRADING_ACCOUNT_NAME_PAPER,
  ALPACA_TRADING_LIVE_ENDPOINT,
} from "./alpaca.constants";
import { type AlpacaAccountCredentials } from "./alpaca.types";
import { type AlpacaApiGetPosition } from "./alpacaApi.types";

export const MOCK_ALPACA_ACCOUNTS: Record<string, AlpacaAccountCredentials> = {
  [ALPACA_TRADING_ACCOUNT_NAME_LIVE]: {
    endpoint: "mockLiveEndpoint",
    key: "mockLiveKey",
    secret: "mockLiveSecret",
    paper: false,
  },
  [ALPACA_TRADING_ACCOUNT_NAME_PAPER]: {
    endpoint: "mockPaperEndpoint",
    key: "mockPaperKey",
    secret: "mockPaperSecret",
    paper: true,
  },
};

export const mockCredentials: AlpacaAccountCredentials = {
  endpoint: ALPACA_TRADING_LIVE_ENDPOINT,
  key: "mockKey",
  secret: "mockSecret",
  paper: true,
};

export const mockPositionDetails: AlpacaApiGetPosition = {
  position: "mockPosition",
  qty: "100.5",
  market_value: "15000.75",
};
