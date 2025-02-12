import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { ALPACA_TRADINGVIEW_INVERSE_PAIRS } from "~/actions/exchanges/alpaca/alpaca.constants";
import { ALPACA_TRADINGVIEW_SYMBOLS } from "~/actions/exchanges/alpaca/alpaca.constants";
import { getAlpacaPositionForAsset } from "~/actions/exchanges/alpaca/alpacaAccount.utils";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";
import { tradingViewAlertSchema } from "~/actions/exchanges/exchanges.types";

export async function POST(request: Request) {
  console.log("Endpoint called - alpaca/pairtradebuyalert");

  try {
    const json: unknown = await request.json();
    const tradingViewAlert = tradingViewAlertSchema.parse(json);
    const validAuthenticationToken = process.env.TRADINGVIEW_AUTH_TOKEN;

    if (tradingViewAlert.authenticationToken !== validAuthenticationToken) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buyAlert = true;
    const alpacaSymbol: string | undefined = buyAlert
      ? ALPACA_TRADINGVIEW_SYMBOLS[tradingViewAlert.ticker]
      : ALPACA_TRADINGVIEW_INVERSE_PAIRS[tradingViewAlert.ticker];

    if (alpacaSymbol) {
      const { openPositionFound } =
        await getAlpacaPositionForAsset(alpacaSymbol);

      if (openPositionFound) {
        return new Response(
          JSON.stringify({
            message: "alpaca/pairtradebuyalert - Position already open",
          }),
          {
            status: 200,
          },
        );
      }
    }

    await alpacaSubmitPairTradeOrder({
      tradingViewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
      tradingViewInterval: tradingViewAlert.interval,
    });

    return new Response(
      JSON.stringify({
        message: `alpaca/pairtradebuyalert - LONG position opened for: ${tradingViewAlert.ticker}`,
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
        "alpaca/pairtradebuyalert - Validation error:",
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
      console.error("alpaca/pairtradebuyalert - error:", error);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
