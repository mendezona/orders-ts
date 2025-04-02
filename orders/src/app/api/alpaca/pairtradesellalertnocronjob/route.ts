import * as Sentry from "@sentry/nextjs";
import { ALPACA_TRADINGVIEW_SYMBOLS } from "~/actions/exchanges/alpaca/alpaca.constants";
import { ALPACA_TRADINGVIEW_INVERSE_PAIRS } from "~/actions/exchanges/alpaca/alpaca.constants";
import { getAlpacaPositionForAsset } from "~/actions/exchanges/alpaca/alpacaAccount.utils";
import { alpacaSubmitPairTradeOrder } from "~/actions/exchanges/alpaca/alpacaOrders.utils";
import { tradingViewAlertSchema } from "~/actions/exchanges/exchanges.types";

export async function POST(request: Request) {
  console.log("Endpoint called - alpaca/pairtradesellalertnocronjob");

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

    const buyAlert = false;
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
      buyAlert: false,
      scheduleCronJob: false,
      useExtendedHours: tradingViewAlert.useExtendedHours,
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
    console.error("alpaca/pairtradesellalertnocronjob - error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
