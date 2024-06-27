/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  ALPACA_PAPER_TRADING_ACCOUNT_NAME,
} from "./alpaca.constants";
import { alpacaGetCredentials } from "./alpacaAccount.utils";
import {
  MOCK_ALPACA_ACCOUNTS,
  mockPositionDetails,
} from "./alpacaAccount.utils.test.mockdata";

jest.mock("@alpacahq/alpaca-trade-api", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      getPosition: jest.fn().mockResolvedValue(mockPositionDetails),
    })),
  };
});

jest.mock("~/server/queries", () => jest.fn());

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

describe("alpacaGetCredentials", () => {
  it("should return live account credentials when development mode is false", () => {
    const credentials = alpacaGetCredentials(
      ALPACA_LIVE_TRADING_ACCOUNT_NAME,
      false,
    );
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_LIVE_TRADING_ACCOUNT_NAME],
    );
  });
  it("should return paper account credentials when development mode is true", () => {
    const credentials = alpacaGetCredentials(
      ALPACA_LIVE_TRADING_ACCOUNT_NAME,
      true,
    );
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_PAPER_TRADING_ACCOUNT_NAME],
    );
  });
  it("should throw an error when account name does not exist", () => {
    expect(() => alpacaGetCredentials("nonExistingAccount")).toThrow(
      "Alpaca account credentials not found",
    );
  });
  it("should return paper account credentials by default when development mode is true", () => {
    const credentials = alpacaGetCredentials(undefined, true);
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_PAPER_TRADING_ACCOUNT_NAME],
    );
  });
  it("should return live account credentials by default when development mode is false", () => {
    const credentials = alpacaGetCredentials(undefined, false);
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_LIVE_TRADING_ACCOUNT_NAME],
    );
  });
});
