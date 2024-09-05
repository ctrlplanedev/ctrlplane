import type { NextRequest } from "next/server";

import {
  accessQuery,
  getUser as getUserFromApiKey,
} from "@ctrlplane/auth/utils";
import { db } from "@ctrlplane/db/client";

export const getUser = async (req: NextRequest) => {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey == null) return { access: accessQuery(db) };
  return getUserFromApiKey(apiKey);
};
