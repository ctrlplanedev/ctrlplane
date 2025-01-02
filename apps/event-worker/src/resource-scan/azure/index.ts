import { logger } from "@ctrlplane/logger";

import { createResourceScanWorker } from "../index.js";
import { getAksResources } from "./aks.js";

const log = logger.child({ label: "resource-scan/azure" });

export const createAzureResourceScanWorker = () =>
  createResourceScanWorker(async (rp) => {
    console.log("GETTING AKS RESOURCES");
    if (rp.resource_provider_azure == null) {
      log.info(
        `No Azure provider found for resource provider ${rp.resource_provider.id}, skipping scan`,
      );
      return [];
    }

    const resources = await getAksResources(
      rp.workspace,
      rp.resource_provider_azure,
    );

    log.info(`Found ${resources.length} AKS resources`);

    return resources;
  });
