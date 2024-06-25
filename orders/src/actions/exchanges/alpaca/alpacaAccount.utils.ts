/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { getLatestTaxAmountCurrentFinancialYear } from "~/server/queries";
import { DEVELOPMENT_MODE } from "../../actions.constants";
import {
  ALPACA_ACCOUNTS,
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  ALPACA_PAPER_TRADING_ACCOUNT_NAME,
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
 * @returns An AlpacaAccountCredentials object containing the endpoint, key, secret, and paper.
 */
export const alpacaGetCredentials = (
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  developmentModeToggle: boolean = DEVELOPMENT_MODE,
): AlpacaAccountCredentials => {
  const accountInfo: AlpacaAccountCredentials | undefined =
    !developmentModeToggle
      ? ALPACA_ACCOUNTS[accountName]
      : ALPACA_ACCOUNTS[ALPACA_PAPER_TRADING_ACCOUNT_NAME];

  if (accountInfo) {
    console.log("Alpaca account credentials found");
    return {
      endpoint: accountInfo.endpoint,
      key: accountInfo.key,
      secret: accountInfo.secret,
      paper: accountInfo.paper,
    };
  } else {
    const errorMessage = "Alpaca account credentials not found";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Retrieves the account balance.
 *
 * @param accountName - The name of the account to trade with.
 *
 * @returns An object containing account details, equity, and cash.
 */
export const alpacaGetAccountBalance = async (
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<AlpacaGetAccountBalance> => {
  const credentials = alpacaGetCredentials(accountName);

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const account = (await alpaca.getAccount()) satisfies TradeAccount;
    const currentProfitAmount: string =
      await getLatestTaxAmountCurrentFinancialYear();
    const runningTotalOfTaxableProfits: Decimal = new Decimal(
      currentProfitAmount,
    );
    const equity: Decimal = new Decimal(account.equity as string).minus(
      runningTotalOfTaxableProfits,
    );
    const cash: Decimal = new Decimal(account.cash as string).minus(
      runningTotalOfTaxableProfits,
    );

    console.log("Available equity minus taxable profits:", equity);
    console.log("Available cash minus taxable profits:", cash);

    return {
      account,
      accountEquity: equity,
      accountCash: cash,
    };
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error fetching account balance:", error);
    throw error;
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
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<AlpacaGetAvailableAssetBalance> => {
  const credentials = alpacaGetCredentials(accountName);

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
      const errorMessage = "Position details not found";
      console.log(errorMessage);
      Sentry.captureMessage(errorMessage);
      throw new Error(errorMessage);
    }

    return {
      position: positionDetails.position,
      qty: new Decimal(positionDetails.qty),
      market_value: new Decimal(positionDetails.market_value),
    };
  } catch (error) {
    Sentry.captureException(error);
    console.error(`Error getting position for ${symbol}:`, error);
    throw error;
  }
};
