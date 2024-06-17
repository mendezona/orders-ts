import * as Sentry from "@sentry/nextjs";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("API called - alpaca/checkpriceatnextinterval");

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    return res.status(200).json({
      message: "Price check at next interval successful",
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);

    return res.status(500).json({
      error: "There was an error",
    });
  }
}
