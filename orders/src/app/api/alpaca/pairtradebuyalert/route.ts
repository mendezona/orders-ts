import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { tradingViewAlertSchema } from "~/actions/exchanges/alpaca/alpaca.types";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";

export async function POST(request: Request) {
  console.log("Endpoint called - alpaca/pairtradebuyalert");
  const validAuthenticationToken = process.env.TRADINGVIEW_AUTH_TOKEN;

  let tradingViewAlert;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    tradingViewAlert = tradingViewAlertSchema.parse(json);
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      },
    });
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors);
      return new Response(
        JSON.stringify({
          error: "Invalid request data",
          details: error.errors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    } else {
      console.error("Error parsing request body:", error);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (tradingViewAlert.authenticationToken !== validAuthenticationToken) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await alpacaSubmitPairTradeOrder({
      tradingViewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
      tradingViewInterval: tradingViewAlert.interval,
    });

    return new Response(
      JSON.stringify({
        message: `Endpoint success - alpaca/pairtradebuyalert - LONG position opened for: ${tradingViewAlert.ticker}`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        tradingViewAlert,
      },
    });
    console.error(
      "Endpoint error - alpaca/pairtradebuyalert, error processing trade order:",
      error,
    );

    return new Response(JSON.stringify({ message: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
