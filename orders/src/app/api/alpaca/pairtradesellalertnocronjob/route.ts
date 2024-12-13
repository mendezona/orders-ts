import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { tradingViewAlertSchema } from "~/actions/exchanges/alpaca/alpaca.types";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";

export async function POST(request: Request) {
  console.log("Endpoint called - alpaca/pairtradesellalertnocronjob");

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    const tradingViewAlert = tradingViewAlertSchema.parse(json);
    const validAuthenticationToken = process.env.TRADINGVIEW_AUTH_TOKEN;
    if (tradingViewAlert.authenticationToken !== validAuthenticationToken) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await alpacaSubmitPairTradeOrder({
      tradingViewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
      tradingViewInterval: tradingViewAlert.interval,
      buyAlert: false,
      scheduleCronJob: false,
    });

    return new Response(
      JSON.stringify({
        message: `alpaca/pairtradesellalertnocronjob - SHORT position opened for: ${tradingViewAlert.ticker}`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    Sentry.captureException(error);
    if (error instanceof z.ZodError) {
      console.error(
        "alpaca/pairtradesellalertnocronjob - Validation error:",
        error.errors,
      );
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: error.errors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    } else {
      console.error("alpaca/pairtradesellalertnocronjob - error:", error);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
