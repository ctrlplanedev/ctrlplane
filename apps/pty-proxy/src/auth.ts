import type { IncomingMessage } from "http";
import type { Session } from "next-auth";

import { env } from "./config.js";

export const getSession = async (req: IncomingMessage) => {
  const options: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
    },
  };
  const res = await fetch(`${env.AUTH_URL}/api/auth/session`, options);
  const data = (await res.json()) as Session | null;
  if (!res.ok) throw new Error("Failed to get session");
  return data;
};
