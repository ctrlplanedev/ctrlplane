import type { NextRequest } from "next/server";

import { getUser as getUserFromApiKey } from "@ctrlplane/auth/utils";

export const getUser = async (req: NextRequest) =>
  req.headers.get("x-api-key") != null
    ? getUserFromApiKey(req.headers.get("x-api-key")!)
    : null;
