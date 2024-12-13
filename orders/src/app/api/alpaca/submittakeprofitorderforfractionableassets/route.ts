import * as Sentry from "@sentry/nextjs";
import { alpacaSubmitTakeProfitOrderForFractionableAssets } from "~/actions/exchanges/alpaca/alpacaOrders.utils";

export async function POST() {
  console.log(
    "Endpoint called - alpaca/submittakeprofitorderforfractionableassets",
  );

  try {
    const response = await alpacaSubmitTakeProfitOrderForFractionableAssets();

    return response;
  } catch (error) {
    Sentry.captureException(error);
    console.error("Failed to submit fractionable take profit order:", error);
    return new Response(JSON.stringify({ message: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
