/* eslint-disable @typescript-eslint/no-unsafe-return */
import Alpaca from "@alpacahq/alpaca-trade-api";
import Decimal from "decimal.js";
import {
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  ALPACA_TRADING_ACCOUNT_NAME_PAPER,
} from "./alpaca.constants";
import { type AlpacaGetAvailableAssetBalance } from "./alpaca.types";
import { alpacaGetAvailableAssetBalance, alpacaGetCredentials } from "./alpacaAccount.utils";
import { MOCK_ALPACA_ACCOUNTS, mockCredentials, mockPositionDetails } from "./alpacaAccount.utils.test.mockdata";

jest.mock('@alpacahq/alpaca-trade-api', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      getPosition: jest.fn().mockResolvedValue(mockPositionDetails),
    })),
  };
});


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
      ALPACA_TRADING_ACCOUNT_NAME_LIVE,
      false,
    );
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_LIVE],
    );
  });
  it("should return paper account credentials when development mode is true", () => {
    const credentials = alpacaGetCredentials(
      ALPACA_TRADING_ACCOUNT_NAME_LIVE,
      true,
    );
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_PAPER],
    );
  });
  it('should throw an error when account name does not exist', () => {
    expect(() => alpacaGetCredentials('nonExistingAccount')).toThrow('Alpaca account credentials not found');
  });
  it("should return paper account credentials by default when development mode is true", () => {
    const credentials = alpacaGetCredentials(undefined, true);
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_PAPER],
    );
  });
  it("should return live account credentials by default when development mode is false", () => {
    const credentials = alpacaGetCredentials(undefined, false);
    expect(credentials).toEqual(
      MOCK_ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_LIVE],
    );
  });
});

describe('alpacaGetAvailableAssetBalance', () => {
  beforeEach(() => {
    jest.doMock('./alpacaAccount.utils', () => ({
      alpacaGetCredentials: jest.fn().mockReturnValue(mockCredentials),
    }));
  });
  it('should return available asset balance for the given symbol', async () => {
    const result: AlpacaGetAvailableAssetBalance = await alpacaGetAvailableAssetBalance('AAPL');
    expect(result.position).toBe(mockPositionDetails.position);
    expect(result.qty).toEqual(new Decimal(mockPositionDetails.qty));
    expect(result.market_value).toEqual(new Decimal(mockPositionDetails.market_value));
  });
  it('should throw an error if getPosition fails', async () => {
    const AlpacaMock = Alpaca as jest.MockedClass<typeof Alpaca>;
    const alpacaInstance = new AlpacaMock();
    (alpacaInstance.getPosition as jest.Mock).mockRejectedValueOnce(new Error('API error'));
    AlpacaMock.mockImplementation(() => alpacaInstance);
    await expect(alpacaGetAvailableAssetBalance('AAPL')).rejects.toThrow('Error getting position for: AAPL');
  });
});

