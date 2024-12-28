import { logger } from "@ctrlplane/logger";

import { createResourceScanWorker } from "../utils.js";
import { getEksResources } from "./eks.js";
import { getVpcResources } from "./vpc.js";

const log = logger.child({ label: "resource-scan/aws" });

export const createAwsResourceScanWorker = () =>
  createResourceScanWorker(async (rp) => {
    if (rp.resource_provider_aws == null) {
      log.info(
        `No AWS provider found for resource provider ${rp.resource_provider.id}, skipping scan`,
      );
      return [];
    }

    const eksResources = await getEksResources(
      rp.workspace,
      rp.resource_provider_aws,
    );

    const vpcResources = await getVpcResources(
      rp.workspace,
      rp.resource_provider_aws,
    );

    return [...eksResources, ...vpcResources];
  });
