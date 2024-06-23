import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { bybitCheckLatestPriceAndReverseTradeCronJob } from "~/actions/exchanges/bybit/bybitCronJobs";

export const dynamic = "force-dynamic";

const bybitCheckLatestPriceAndReverseTradeCronJobParamsSchema = z.object({
  tradingViewSymbol: z.string(),
  buyAlert: z.boolean(),
});

export const POST = verifySignatureAppRouter(async (request: Request) => {
  console.log("API called - bybit/checkpriceatnextinterval");

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    const data =
      bybitCheckLatestPriceAndReverseTradeCronJobParamsSchema.parse(json);
    console.log("checkpriceatnextinterval: data", data);

    await bybitCheckLatestPriceAndReverseTradeCronJob({
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
        "Endpoint error - bybit/checkpriceatnextinterval, error scheduling cron job:",
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
