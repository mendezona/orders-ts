import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { bybitSubmitPairTradeOrder } from "~/actions/exchanges/bybit/bybitOrders.utils";

export const dynamic = "force-dynamic";

const tradingViewAlertSchema = z.object({
  authenticationToken: z.string(),
  ticker: z.string(),
  closePrice: z.string(),
  interval: z.string(),
});

export async function POST(request: Request) {
  console.log("Endpoint called - bybit/pairtradesellalert");
  const validAuthenticationToken = process.env.TRADINGVIEW_AUTH_TOKEN;

  let tradingViewAlert;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    tradingViewAlert = tradingViewAlertSchema.parse(json);
  } catch (error) {
    Sentry.captureException(error);
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
    await bybitSubmitPairTradeOrder({
      tradingViewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
      tradingViewInterval: tradingViewAlert.interval,
      buyAlert: false,
    });

    return new Response(
      JSON.stringify({
        message:
          "Endpoint success - bybit/pairtradesellalert - buy order submitted",
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
    console.error(
      "Endpoint error - bybit/pairtradesellalert, error processing trade order:",
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
