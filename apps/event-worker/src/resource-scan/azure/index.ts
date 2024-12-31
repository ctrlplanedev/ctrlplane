import { createResourceScanWorker } from "../utils.js";
import { getAksResources } from "./aks.js";

export const createAzureResourceScanWorker = () =>
  createResourceScanWorker(async (rp) =>
    rp.resource_provider_azure == null
      ? []
      : getAksResources(rp.workspace, rp.resource_provider_azure),
  );
