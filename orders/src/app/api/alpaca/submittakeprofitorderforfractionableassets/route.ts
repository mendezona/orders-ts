import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { ALPACA_LIVE_TRADING_ACCOUNT_NAME } from "~/actions/exchanges/alpaca/alpaca.constants";
import { alpacaGetCredentials } from "~/actions/exchanges/alpaca/alpacaAccount.utils";
import {
  OrderTypeSchema,
  TimeInForceSchema,
} from "~/actions/exchanges/alpaca/alpacaApi.types";
import { scheduleFractionableTakeProfitOrderCronJob } from "~/actions/exchanges/alpaca/alpacaCronJob.helpers";
import { getFirstFractionableTakeProfitOrder } from "~/server/queries";

export const dynamic = "force-dynamic";

export async function POST() {
  console.log(
    "Endpoint called - alpaca/submittakeprofitorderforfractionableassets",
  );

  try {
    const order = await getFirstFractionableTakeProfitOrder();
    if (!order) {
      console.log("No fractionable take profit orders found");
      return new Response(JSON.stringify({ message: "No orders found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const takeProfitOrderRequest = {
      symbol: order.symbol,
      qty: new Decimal(order.quantity).toNumber(),
      side: order.side,
      type: OrderTypeSchema.Enum.limit,
      time_in_force: TimeInForceSchema.Enum.day,
      limit_price: new Decimal(order.limitPrice).toNumber(),
      extended_hours: true,
    };

    const credentials = alpacaGetCredentials(ALPACA_LIVE_TRADING_ACCOUNT_NAME);
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    // Execute order submission and schedule another cron job
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [orderResponse] = await Promise.all([
      alpaca.createOrder(takeProfitOrderRequest),
      scheduleFractionableTakeProfitOrderCronJob(),
    ]);

    console.log(
      `Take Profit Limit ${order.side} order submitted: \n`,
      orderResponse,
    );

    return new Response(
      JSON.stringify({
        message: `Successfully submitted take profit order for ${order.symbol}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error("Failed to submit fractionable take profit order:", error);
    return new Response(JSON.stringify({ message: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
