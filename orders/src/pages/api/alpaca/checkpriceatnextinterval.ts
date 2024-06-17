import * as Sentry from "@sentry/nextjs";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/dist/server/web/spec-extension/response";

const handler = async (_req: Request) => {
  console.log("API called - alpaca/checkpriceatnextinterval");
  try {
    return NextResponse.json({ message: "Success" }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "Endpoint error - alpaca/checkpriceatnextinterval, error scheduling cron job:",
      error,
    );
    return NextResponse.json(
      { message: "There was an error with alpace/checkpriceatnextinterval" },
      { status: 500 },
    );
  }
};

export const POST = verifySignatureAppRouter(handler);
