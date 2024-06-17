import * as Sentry from "@sentry/nextjs";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";
import { type TradingViewAlert } from "~/actions/exchanges/exchanges.types";

export const dynamic = "force-dynamic"; // Ensuring the API route is dynamic

export async function POST(request: Request) {
  console.log("API called - alpaca/pairtradesellalert");

  const validAuthenticationToken = process.env.TRADINGVIEW_AUTH_TOKEN;

  let tradingViewAlert: TradingViewAlert;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    tradingViewAlert = await request.json();
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error parsing request body:", error);
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
    });
  }

  if (tradingViewAlert.authenticationToken !== validAuthenticationToken) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    await alpacaSubmitPairTradeOrder({
      tradingViewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
      buyAlert: false,
    });

    return new Response(
      JSON.stringify({
        message:
          "Endpoint success - alpaca/pairtradesellalert - sell order submitted",
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
      "Endpoint error - alpaca/pairtradesellalert, error processing trade order:",
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
