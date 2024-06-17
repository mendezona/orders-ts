import * as Sentry from "@sentry/nextjs";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";
import { type TradingViewAlert } from "~/actions/exchanges/exchanges.types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  console.log("Endpoint called - alpaca/pairtradebuyalert");

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
      tradingviewSymbol: tradingViewAlert.ticker,
      tradingViewPrice: tradingViewAlert.closePrice,
    });

    return new Response(
      JSON.stringify({
        message:
          "Endpoint success - alpaca/pairtradebuyalert - buy order submitted",
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
