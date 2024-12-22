import { logger } from "@ctrlplane/logger";

import { createResourceScanWorker } from "../utils.js";
import { getGkeResources } from "./gke.js";

const log = logger.child({ label: "resource-scan/google" });

export const createGoogleResourceScanWorker = () =>
  createResourceScanWorker(async (rp) => {
    if (rp.resource_provider_google == null) {
      log.info(
        `No Google provider found for resource provider ${rp.resource_provider.id}, skipping scan`,
      );
      return [];
    }

    const resources = await getGkeResources(
      rp.workspace,
      rp.resource_provider_google,
    );

    return resources;
  });
