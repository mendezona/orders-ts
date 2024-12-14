import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema } from "~/actions/exchanges/alpaca/alpaca.types";
import { alpacaCheckLatestPriceAndReverseTradeCronJob } from "~/actions/exchanges/alpaca/alpacaCronJobs";

export const POST = verifySignatureAppRouter(async (request: Request) => {
  console.log("API called - alpaca/checkpriceatnextinterval");

  try {
    const json = (await request.json()) as unknown;
    const data =
      alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema.parse(json);

    await alpacaCheckLatestPriceAndReverseTradeCronJob({
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
      console.error(
        "Endpoint error - alpaca/checkpriceatnextinterval, error scheduling cron job:",
        error,
      );
      return new Response(JSON.stringify({ success: false }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }
});
