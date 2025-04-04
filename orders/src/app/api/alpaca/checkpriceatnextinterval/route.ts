import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema } from "~/actions/exchanges/alpaca/alpaca.types";
import { alpacaSubmitReverseTradeOnFalseSignal } from "~/actions/exchanges/alpaca/alpacaOrders.utils";

export const POST = verifySignatureAppRouter(async (request: Request) => {
  console.log("API called - alpaca/checkpriceatnextinterval");

  try {
    const json: unknown = await request.json();
    const data =
      alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema.parse(json);

    await alpacaSubmitReverseTradeOnFalseSignal({
      tradingViewSymbol: data.tradingViewSymbol,
      buyAlert: data.buyAlert,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("alpaca/checkpriceatnextinterval - error:", error);
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
});
