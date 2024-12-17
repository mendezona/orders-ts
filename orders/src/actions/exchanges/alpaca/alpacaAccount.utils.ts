import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { ZodError } from "zod";
import { getLatestTaxAmountCurrentFinancialYear } from "~/server/queries";
import { DEVELOPMENT_MODE } from "../../actions.constants";
import {
  ALPACA_ACCOUNTS,
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  ALPACA_PAPER_TRADING_ACCOUNT_NAME,
} from "./alpaca.constants";
import {
  type AlpacaAccountBalance,
  type AlpacaAccountCredentials,
  type AlpacaPositionForAsset,
} from "./alpaca.types";
import {
  AlpacaApiGetPositionSchema,
  AlpacaApiTradeAccountSchema,
} from "./alpacaApi.types";

/**
 * Retrieves the account credentials for trading (most likely paper trading account or live account).
 *
 * @param accountName - The name of the account to trade with.
 * @param developmentModeToggle - Forcibly enable development mode.
 *
 * @returns An AlpacaAccountCredentials object containing the endpoint, key, secret, and paper.
 */
export const getAlpacaCredentials = (
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  developmentModeToggle: boolean = DEVELOPMENT_MODE,
) => {
  const accountInfo = !developmentModeToggle
    ? ALPACA_ACCOUNTS[accountName]
    : ALPACA_ACCOUNTS[ALPACA_PAPER_TRADING_ACCOUNT_NAME];

  if (!accountInfo) {
    throw new Error(
      "getAlpacaCredentials - Alpaca account credentials not found",
    );
  }

  const credentials: AlpacaAccountCredentials = {
    endpoint: accountInfo.endpoint,
    key: accountInfo.key,
    secret: accountInfo.secret,
    paper: accountInfo.paper,
  };
  console.log("getAlpacaCredentials - Alpaca account credentials found");
  return credentials;
};

/**
 * Retrieves the account balance.
 *
 * @param accountName - The name of the account to trade with.
 * @param investTaxableIncome - Flag to decide if taxable income should be reinvested in next trade
 *
 * @returns An object containing account details, equity, and cash.
 */
export const getAlpacaAccountBalance = async (
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
  investTaxableIncome = true,
) => {
  try {
    const credentials = getAlpacaCredentials(accountName);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    const alpacaGetAccount: unknown = await alpaca.getAccount();
    const account = AlpacaApiTradeAccountSchema.parse(alpacaGetAccount);

    const currentProfitAmount = await getLatestTaxAmountCurrentFinancialYear();
    const runningTotalOfTaxableProfits = new Decimal(currentProfitAmount);
    const accountEquity = investTaxableIncome
      ? new Decimal(account.equity!)
      : new Decimal(account.equity!).minus(runningTotalOfTaxableProfits);
    const accountCash = investTaxableIncome
      ? new Decimal(account.cash!)
      : new Decimal(account.cash!).minus(runningTotalOfTaxableProfits);

    console.log(
      "getAlpacaAccountBalance - Available equity minus taxable profits:",
      accountEquity,
    );
    console.log(
      "getAlpacaAccountBalance - Available cash minus taxable profits:",
      accountCash,
    );

    const accountBalance: AlpacaAccountBalance = {
      account,
      accountEquity,
      accountCash,
    };
    return accountBalance;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        function: "getAlpacaAccountBalance",
      },
    });
    if (error instanceof ZodError) {
      console.error(
        "getAlpacaAccountBalance - Error validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.error(
        "getAlpacaAccountBalance - Error fetching account balance:",
        error,
      );
    }
    throw error;
  }
};

/**
 * Get the amount of assets you own available to trade for a single asset.
 *
 * @param symbol - The symbol to search for the available asset balance.
 * @param accountName - The name of the account to search with.
 * @param retries - The number of retries to attempt if the position is not found.
 *
 * @returns A Decimal with the number of available assets.
 */
export const getAlpacaPositionForAsset = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
) => {
  let positionForAsset: AlpacaPositionForAsset;
  try {
    const credentials = getAlpacaCredentials(accountName);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    const alpacaGetPosition: unknown = await alpaca.getPosition(symbol);
    const position = AlpacaApiGetPositionSchema.parse(alpacaGetPosition);

    if (!position.qty || !position.market_value) {
      console.log("getAlpacaPositionForAsset - Position details not found");
      positionForAsset = {
        openPositionFound: false,
      };
      return positionForAsset;
    }

    positionForAsset = {
      openPositionFound: true,
      position,
      qty: new Decimal(position.qty),
      market_value: new Decimal(position.market_value),
    };

    console.log(`Position for ${symbol}:`, position);
    console.log(`Quantity of ${symbol}:`, position.qty);
    console.log(`Market value for ${symbol}:`, position.market_value);
    console.log("getAlpacaPositionForAsset - Position details found");
    return positionForAsset;
  } catch (error) {
    if (error instanceof ZodError) {
      Sentry.captureException(error, {
        tags: {
          function: "getAlpacaPositionForAsset",
        },
      });
      console.error(
        "getAlpacaPositionForAsset - Error validation failed with ZodError:",
        error.errors,
      );
    } else if (
      // @ts-expect-error error is always AxiosError in this context
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      error.response?.status === 404 &&
      // @ts-expect-error error is always AxiosError in this context
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      error.response?.data?.code === 40410000
    ) {
      console.log(
        "getAlpacaPositionForAsset - Position not found, handling gracefully",
      );
    } else {
      console.error(
        "getAlpacaPositionForAsset - Error fetching position details:",
        error,
      );
      Sentry.captureException(error, {
        tags: {
          function: "getAlpacaPositionForAsset",
        },
      });
    }

    positionForAsset = {
      openPositionFound: false,
    };
    return positionForAsset;
  }
};
