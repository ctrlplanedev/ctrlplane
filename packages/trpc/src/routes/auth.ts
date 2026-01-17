import {
  isCredentialsAuthEnabled,
  isGoogleAuthEnabled,
  isOIDCAuthEnabled,
} from "@ctrlplane/auth/server";

import { publicProcedure, router } from "../trpc.js";

export const authRouter = router({
  config: publicProcedure.query(() => ({
    credentialsEnabled: isCredentialsAuthEnabled,
    googleEnabled: isGoogleAuthEnabled,
    oidcEnabled: isOIDCAuthEnabled,
  })),
});
