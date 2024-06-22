import * as Sentry from "@sentry/nextjs";
import { RestClientV5 } from "bybit-api";
import { removeHyphensFromPairSymbol } from "../exchanges.utils";
import {
  BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  BYBIT_PREFERRED_STABLECOIN,
} from "./bybit.constants";
import {
  BybitDefaultProductCategory,
  type BybitAccountCredentials,
  type BybitGetMostRecentInverseFillToStablecoinParams,
} from "./bybit.types";
import { bybitGetCredentials } from "./bybitAcccount.utils";

/**
 * Check if the most recent inverse fill to a stablecoin was a buy or a sell.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens (e.g., "BTC-USDT").
 * @param stablecoin - Stablecoin symbol to check for (e.g., "USDT").
 * @param accountName - The name of the account to use.
 * @param productCategory - The category of the instrument to search for (e.g., spot, linear inverse, or option).
 *
 * @returns The account balance for the specified coin as a string or an error message as a string.
 */
export const bybitGetMostRecentInverseFillToStablecoin = async ({
  bybitPairSymbol,
  stablecoin = BYBIT_PREFERRED_STABLECOIN,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  productCategory = BybitDefaultProductCategory.SPOT,
}: BybitGetMostRecentInverseFillToStablecoinParams): Promise<boolean> => {
  console.log(
    "bybitGetMostRecentInverseFillToStablecoin - finding most recent inverse fill for:",
    bybitPairSymbol,
  );
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  const parsedBybitPairSymbol = removeHyphensFromPairSymbol(bybitPairSymbol);
  try {
    const client = new RestClientV5({
      key: credentials.key,
      secret: credentials.secret,
      testnet: credentials.testnet,
    });

    const response = await client.getExecutionList({
      symbol: parsedBybitPairSymbol,
      category: productCategory,
      limit: 10,
    });

    if (response.retCode === 0) {
      const executedOrders = response.result;

      if (!executedOrders?.list || executedOrders.list.length === 0) {
        return false;
      }

      const orders = executedOrders.list.filter(
        (order) => order.symbol === bybitPairSymbol,
      );
      const lastTrade = orders[0];

      if (lastTrade) {
        const isSellToStablecoin =
          lastTrade.symbol.endsWith(stablecoin) && lastTrade.side === "Sell";
        console.log("Last trade was a sell to stablecoin:", isSellToStablecoin);
        return isSellToStablecoin;
      }
    }

    throw new Error(
      `bybitGetMostRecentInverseFillToStablecoin - Error occured while getting inverse fill to stablecoin for ${parsedBybitPairSymbol}`,
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitGetMostRecentInverseFillToStablecoin - Error occured while getting inverse fill to stablecoin for ${parsedBybitPairSymbol}`,
    );
    throw error;
  }
};
