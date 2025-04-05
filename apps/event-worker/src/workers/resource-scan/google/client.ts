import type { AuthClient } from "google-auth-library";
import { GoogleAuth, Impersonated } from "google-auth-library";

import { logger } from "@ctrlplane/logger";

const log = logger.child({ label: "resource-scan/gke/google" });

export const sourceCredentials = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const getImpersonatedClient = async (targetPrincipal: string) =>
  new Impersonated({
    sourceClient: await sourceCredentials.getClient(),
    targetPrincipal,
    lifetime: 3600,
    delegates: [],
    targetScopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

export const getGoogleClient = async <T>(
  ClientClass: new (options?: any) => T,
  targetPrincipal?: string | null,
  clientName = "Google client",
): Promise<[T, AuthClient | undefined]> => {
  try {
    if (targetPrincipal == null)
      return [new ClientClass(), await sourceCredentials.getClient()];
    const authClient = await getImpersonatedClient(targetPrincipal);
    return [new ClientClass({ authClient }), authClient];
  } catch (error: any) {
    log.error(
      `Failed to get ${clientName}${
        targetPrincipal ? ` for ${targetPrincipal}` : ""
      }: ${error.message}`,
      { error, targetPrincipal },
    );
    throw error;
  }
};
