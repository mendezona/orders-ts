import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { alpacaCheckLatestPriceAndReverseTradeCronJob } from "~/actions/exchanges/alpaca/alpacaCronJobs";

export const dynamic = "force-dynamic";

const alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema = z.object({
  tradingViewSymbol: z.string(),
  buyAlert: z.boolean(),
});

export const POST = verifySignatureAppRouter(async (request: Request) => {
  console.log("API called - alpaca/checkpriceatnextinterval");

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    const data =
      alpacaCheckLatestPriceAndReverseTradeCronJobParamsSchema.parse(json);
    console.log("checkpriceatnextinterval: data", data);

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
