/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from "@alpacahq/alpaca-trade-api";
import Decimal from "decimal.js";
import { getLatestProfitAmountCurrentFinancialYear } from "~/server/queries";
import { DEVELOPMENT_MODE } from "../actions.constants";
import {
  ALPACA_ACCOUNTS,
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  ALPACA_TRADING_ACCOUNT_NAME_PAPER,
} from "./alpaca.constants";
import {
  type AlpacaAccountCredentials,
  type AlpacaGetAccountBalance,
  type AlpacaGetAvailableAssetBalance,
} from "./alpaca.types";
import {
  type AlpacaApiGetPosition,
  type TradeAccount,
} from "./alpacaApi.types";

/**
 * Retrieves the account credentials for trading (most likely paper trading account or live account).
 *
 * @param accountName - The name of the account to trade with.
 * @param developmentModeToggle - Forcibly enable development mode.
 *
 * @returns An AlpacaAccountCredentials object containing the endpoint, key, secret, and paper, to pass to the Bybit SDK API.
 */
export const alpacaGetCredentials = (
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  developmentModeToggle: boolean = DEVELOPMENT_MODE,
): AlpacaAccountCredentials => {
  const accountInfo: AlpacaAccountCredentials | undefined =
    !developmentModeToggle
      ? ALPACA_ACCOUNTS[accountName]
      : ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_PAPER];

  if (accountInfo) {
    console.log("Alpaca account credentials found");
    return {
      endpoint: accountInfo.endpoint,
      key: accountInfo.key,
      secret: accountInfo.secret,
      paper: accountInfo.paper,
    };
  } else {
    throw new Error("Alpaca account credentials not found");
  }
};

/**
 * Retrieves the account balance
 *
 * @param accountName - The name of the account to trade with
 *
 * @returns An object containing account details, equity, and cash, or "Account not found"
 */
export const alpacaGetAccountBalance = async (
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<AlpacaGetAccountBalance> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const account = (await alpaca.getAccount()) satisfies TradeAccount;
    const currentProfitAmount: string =
      await getLatestProfitAmountCurrentFinancialYear();
    const runningTotalOfTaxableProfits: Decimal = new Decimal(
      currentProfitAmount,
    );
    const equity: Decimal = new Decimal(account.equity as string).minus(
      runningTotalOfTaxableProfits,
    );
    const cash: Decimal = new Decimal(account.cash as string).minus(
      runningTotalOfTaxableProfits,
    );

    console.log("account", account);
    console.log("equity:", equity);
    console.log("cash:", cash);

    return {
      account,
      accountEquity: equity,
      accountCash: cash,
    };
  } catch (error) {
    console.error("Error fetching account balance:", error);
    throw new Error("Error fetching account balance");
  }
};

/**
 * Get the amount of assets you own available to trade for a single symbol.
 *
 * @param symbol - The symbol to search for the available asset balance.
 * @param accountName - The name of the account to search with.
 *
 * @returns A Decimal with the number of available assets.
 */
export const alpacaGetAvailableAssetBalance = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<AlpacaGetAvailableAssetBalance> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const positionDetails: AlpacaApiGetPosition = (await alpaca.getPosition(
      symbol,
    )) satisfies AlpacaApiGetPosition;

    console.log(`Position for ${symbol}:`, positionDetails);
    console.log(`Quantity of ${symbol}:`, positionDetails.qty);
    console.log(`Market value for ${symbol}:`, positionDetails.market_value);

    if (!positionDetails.qty || !positionDetails.market_value) {
      throw new Error("Position details not found");
    }

    return {
      position: positionDetails.position,
      qty: new Decimal(positionDetails.qty),
      market_value: new Decimal(positionDetails.market_value),
    };
  } catch (error) {
    console.error(`Error getting position for ${symbol}:`, error);
    throw new Error(`Error getting position for: ${symbol}`);
  }
};
