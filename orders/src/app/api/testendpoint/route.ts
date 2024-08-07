import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  console.log("API called - alpaca/testendpoint");

  try {
    return new Response(JSON.stringify({ message: "Success" }), {
      status: 200,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);
    return new Response(JSON.stringify({ error: "There was an error" }), {
      status: 500,
    });
  }
}
