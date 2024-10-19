import { describe, it, vi } from "vitest";

import { db } from "@ctrlplane/db/client";

import * as jobVariablesDeployment from "../job-variables-deployment/job-variables-deployment.js";
import * as utils from "../job-variables-deployment/utils.js";

vi.mock("../job-variables-deployment", async () => ({
  ...(await vi.importActual("../job-variables-deployment")),
}));

vi.mock("../job-variables-deployment/utils", async () => ({
  ...(await vi.importActual("../job-variables-deployment/utils")),
  getJob: vi.fn(),
  getDeploymentVariables: vi.fn(),
  getTarget: vi.fn(),
  getEnvironment: vi.fn(),
  getVariableValues: vi.fn(),
}));

describe("job-variables-deployment", () => {
  it("should create release variables", async () => {
    vi.mocked(utils.getJob).mockResolvedValue({
      job: {
        id: "00000000-0000-0000-0000-000000000000",
      },
      release_job_trigger: {
        id: "00000000-0000-0000-0000-000000000000",
      },
    } as any);

    const job = await utils.getJob(db, "00000000-0000-0000-0000-000000000000");
    console.log(job);

    await jobVariablesDeployment.createReleaseVariables(
      db,
      "00000000-0000-0000-0000-000000000000",
    );
  });
});
