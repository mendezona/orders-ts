/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import { ALPACA_LIVE_TRADING_ACCOUNT_NAME } from "./alpaca.constants";
import { alpacaGetCredentials } from "./alpacaAccount.utils";
import {
  OrderSide,
  OrderStatus,
  QueryOrderStatus,
  type Order,
} from "./alpacaApi.types";

/**
 * Check if last filled order for an asset was a buy or a sell.
 *
 * @param symbol - The symbol to check if it was a buy or sell, e.g., APPL.
 * @param accountName - Account to check the history of.
 *
 * @returns - An OrderSide object ("buy" or "sell").
 */
export const alpacaCheckLastFilledOrderType = async (
  symbol: string,
  accountName: string = ALPACA_LIVE_TRADING_ACCOUNT_NAME,
): Promise<OrderSide> => {
  console.log(
    `alpacaCheckLastFilledOrderType - Checking last filled order for ${symbol}`,
  );
  const credentials = alpacaGetCredentials(accountName);

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const recentClosedOrders = (await alpaca.getOrders({
      symbols: symbol,
      status: QueryOrderStatus.CLOSED,
      limit: 10,
      direction: null,
      until: null,
      after: null,
      nested: null,
    })) satisfies Order[];

    // Filter out only filled orders
    const filledOrders: Order[] = recentClosedOrders.filter(
      (order: Order) => order.status === OrderStatus.FILLED,
    );

    // Check if there are any filled orders
    if (filledOrders.length === 0 || filledOrders[0] === undefined) {
      const errorMessage = "Error fetching last closed orders";
      console.log(errorMessage);
      Sentry.captureMessage(errorMessage);
      throw new Error(errorMessage);
    }

    // Get the most recent filled order
    const lastFilledOrder: Order = filledOrders[0];
    const orderSide: OrderSide =
      lastFilledOrder.side === OrderSide.BUY ? OrderSide.BUY : OrderSide.SELL;

    console.log(`Last order for ${symbol} was a `, orderSide);
    return orderSide;
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error fetching last closed orders:", error);
    throw error;
  }
};
