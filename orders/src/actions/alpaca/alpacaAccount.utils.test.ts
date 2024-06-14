import {
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  ALPACA_TRADING_ACCOUNT_NAME_PAPER,
} from "./alpaca.constants";
import { type AlpacaAccountCredentials } from "./alpaca.types";
import { getAlpacaCredentials } from "./alpacaAccount.utils";

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock("./alpaca.constants", () => ({
  ...jest.requireActual("./alpaca.constants"),
  ALPACA_ACCOUNTS: {
    alpacaTradingAccountNameLive: {
      endpoint: "mockLiveEndpoint",
      key: "mockLiveKey",
      secret: "mockLiveSecret",
      paper: false,
    },
    alpacaTradingAccountNamePaper: {
      endpoint: "mockPaperEndpoint",
      key: "mockPaperKey",
      secret: "mockPaperSecret",
      paper: true,
    },
  },
}));

const MOCK_ALPACA_ACCOUNTS: Record<string, AlpacaAccountCredentials> = {
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

describe("getAlpacaCredentials", () => {
  it("should return live account credentials when development mode is false", () => {
    const credentials = getAlpacaCredentials(
      ALPACA_TRADING_ACCOUNT_NAME_LIVE,
      false,
    );
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_LIVE],
    );
  });
  it("should return paper account credentials when development mode is true", () => {
    const credentials = getAlpacaCredentials(
      ALPACA_TRADING_ACCOUNT_NAME_LIVE,
      true,
    );
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_PAPER],
    );
  });
  it("should return undefined when account name does not exist", () => {
    const credentials = getAlpacaCredentials("nonExistingAccount", false);
    expect(credentials).toBeUndefined();
  });
  it("should return paper account credentials by default when development mode is true", () => {
    const credentials = getAlpacaCredentials(undefined, true);
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_PAPER],
    );
  });
  it("should return live account credentials by default when development mode is false", () => {
    const credentials = getAlpacaCredentials(undefined, false);
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_LIVE],
    );
  });
});
