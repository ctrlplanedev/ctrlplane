import type { IncomingMessage } from "http";
import type { Session } from "next-auth";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";

export const getSession = async (req: IncomingMessage) => {
  const options: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
    },
  };
  try {
    const res = await fetch(`${env.AUTH_URL}/api/auth/session`, options);
    const data = (await res.json()) as Session | null;
    if (!res.ok) {
      logger.error("Failed to get session from auth service", {
        status: res.status,
        statusText: res.statusText,
      });
      throw new Error("Failed to get session");
    }
    return data;
  } catch (error) {
    logger.error("Error getting session", {
      error,
      authUrl: env.AUTH_URL,
      hasCookie: Boolean(req.headers.cookie),
    });
    throw error;
  }
};
