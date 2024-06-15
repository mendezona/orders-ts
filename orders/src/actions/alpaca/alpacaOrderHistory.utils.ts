/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from "@alpacahq/alpaca-trade-api";
import { ALPACA_TRADING_ACCOUNT_NAME_LIVE } from "./alpaca.constants";
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
 * @param account - Account to check the history of.
 *
 * @returns - An OrderSide object ("buy" or "sell").
 */
export const alpacaCheckLastFilledOrderType = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<OrderSide> => {
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
    const recentClosedOrders = (await alpaca.getOrders({
      symbols: [symbol],
      status: QueryOrderStatus.CLOSED,
      limit: 10,
      direction: null,
      until: null,
      after: null,
      nested: null,
    })) satisfies Order[];
    console.log("Closed orders:", recentClosedOrders);

    // Filter out only filled orders
    const filledOrders: Order[] = recentClosedOrders.filter(
      (order: Order) => order.status === OrderStatus.FILLED,
    );
    console.log("Filled orders:", filledOrders);

    // Check if there are any filled orders
    if (filledOrders.length === 0 || filledOrders[0] === undefined) {
      throw new Error("Error fetching last closed orders");
    }

    // Get the most recent filled order
    const lastFilledOrder: Order = filledOrders[0];
    const orderSide: OrderSide =
      lastFilledOrder.side === OrderSide.BUY ? OrderSide.BUY : OrderSide.SELL;

    console.log("Last order was a", orderSide);
    return orderSide;
  } catch (error) {
    console.error("Error fetching last closed orders:", error);
    throw new Error("Error fetching last closed orders");
  }
};
