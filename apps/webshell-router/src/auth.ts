import type { IncomingMessage } from "http";
import type { Session } from "next-auth";
import type { RequestInit } from "node-fetch";
import fetch from "node-fetch";

import { env } from "./config";

export const getSession = async (req: IncomingMessage) => {
  const options: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
    },
  };
  const res = await fetch(env.AUTH_URL, options);
  const data = (await res.json()) as Session | null;
  if (!res.ok) throw data;
  return data;
};
