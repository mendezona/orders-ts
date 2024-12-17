import * as Sentry from "@sentry/nextjs";
import { alpacaCronJobScheduleTakeProfitOrderForFractionableAsset } from "~/actions/exchanges/alpaca/alpacaCronJobs";
import { alpacaSubmitTakeProfitOrderForFractionableAssets } from "~/actions/exchanges/alpaca/alpacaOrders.utils";

export async function POST() {
  console.log(
    "Endpoint called - alpaca/submittakeprofitorderforfractionableassets",
  );

  try {
    await Promise.all([
      alpacaSubmitTakeProfitOrderForFractionableAssets(),
      alpacaCronJobScheduleTakeProfitOrderForFractionableAsset(),
    ]);

    return new Response(
      JSON.stringify({
        message: `alpaca/submittakeprofitorderforfractionableassets - Take profit order submitted`,
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
      "alpaca/submittakeprofitorderforfractionableassets - error:",
      error,
    );
    return new Response(JSON.stringify({ message: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
