import { createResourceScanWorker } from "../utils.js";
import { getAksResources } from "./aks.js";

export const createAzureResourceScanWorker = () =>
  createResourceScanWorker(async (rp) => {
    if (rp.resource_provider_azure == null) return [];

    const resources = await getAksResources(
      rp.workspace,
      rp.resource_provider_azure,
    );

    return resources;
  });
