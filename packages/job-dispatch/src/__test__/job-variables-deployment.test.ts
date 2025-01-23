import type * as SCHEMA from "@ctrlplane/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@ctrlplane/db/client";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { ReleaseStatus } from "@ctrlplane/validators/releases";

import * as jobVariablesDeployment from "../job-variables-deployment/job-variables-deployment.js";
import * as utils from "../job-variables-deployment/utils.js";

vi.mock("../job-variables-deployment", async () => ({
  ...(await vi.importActual("../job-variables-deployment")),
}));

vi.mock("../job-variables-deployment/utils", async () => ({
  ...(await vi.importActual("../job-variables-deployment/utils")),
  getJob: vi.fn(),
  getResourceVariableValue: vi.fn(),
  getDeploymentVariables: vi.fn(),
  getResource: vi.fn(),
  getEnvironment: vi.fn(),
  getVariableValues: vi.fn(),
  getFirstMatchedResource: vi.fn(),
}));

type Job = {
  job: SCHEMA.Job;
  release_job_trigger: SCHEMA.ReleaseJobTrigger;
};

const job: Job = {
  job: {
    id: "0",
    jobAgentId: null,
    jobAgentConfig: {},
    externalId: null,
    status: JobStatus.Pending,
    message: null,
    reason: "policy_passing",
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
  },
  release_job_trigger: {
    id: "0",
    jobId: "0",
    type: "new_release",
    releaseId: "0",
    resourceId: "0",
    environmentId: "0",
    createdAt: new Date(),
    causedById: null,
  },
};

const resource: SCHEMA.Resource = {
  id: "0",
  name: "test",
  workspaceId: "0",
  config: {},
  updatedAt: new Date(),
  version: "0",
  kind: "test",
  identifier: "test",
  providerId: "0",
  lockedAt: null,
  createdAt: new Date(),
  deletedAt: null,
};

const release: SCHEMA.Release = {
  id: "0",
  name: "test",
  config: {},
  createdAt: new Date(),
  version: "0",
  deploymentId: "0",
  status: ReleaseStatus.Ready,
  message: null,
  jobAgentConfig: {},
};

const variableValues: SCHEMA.DeploymentVariableValue[] = [
  {
    id: "0",
    variableId: "0",
    value: "test1",
    resourceFilter: null,
  },
  {
    id: "1",
    variableId: "0",
    value: "test2",
    resourceFilter: null,
  },
  {
    id: "2",
    variableId: "0",
    value: "test3",
    resourceFilter: null,
  },
];

type variable = {
  deployment_variable: SCHEMA.DeploymentVariable;
  release: SCHEMA.Release;
};

describe("job-variables-deployment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return direct match value if it exists", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: "0",
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(
      variableValues[1],
    );
    vi.mocked(utils.getEnvironment).mockResolvedValue(undefined);

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual(variableValues[1]!.value);
  });

  it("should return default value if no direct match exists", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: "0",
        },
        release,
      },
    ];
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);
    vi.mocked(utils.getEnvironment).mockResolvedValue(undefined);

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual(variableValues[0]!.value);
  });

  it("should return null if no direct match or default value exists", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: null,
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);
    vi.mocked(utils.getEnvironment).mockResolvedValue(undefined);

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(0);
  });

  it("should include variables from matched variable set", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: "0",
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(
      variableValues[1],
    );

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "test",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test2",
                variableSetId: "0",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.value).toEqual(variableValues[1]!.value);
    expect(result[1]!.value).toEqual("test4");
  });

  it("should not include variables from matched variable set if direct match exists and key matches", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: "0",
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(
      variableValues[1],
    );

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "test",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test",
                variableSetId: "0",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual(variableValues[1]!.value);
  });

  it("should not include variables from matched variable set if default value exists and key matches", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: "0",
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "test",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test",
                variableSetId: "0",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual(variableValues[0]!.value);
  });

  it("should override value with variable set value if key matches and no direct match or default value exists", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: null,
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "test",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test",
                variableSetId: "0",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual("test4");
  });

  it("should override value with variable set value from first alphabetically sorted variable set if no direct match or default value exists and more than one variable set is assigned", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: null,
        },
        release,
      },
    ];
    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(null);
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "testb",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test",
                variableSetId: "0",
              },
            ],
          },
        },
        {
          id: "1",
          variableSetId: "1",
          environmentId: "0",
          variableSet: {
            id: "1",
            name: "testa",
            description: null,
            systemId: "0",
            values: [
              {
                id: "1",
                value: "test5",
                key: "test",
                variableSetId: "1",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual("test5");
  });

  it("should prioritize resource variable if it exists", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const resourceVariable: SCHEMA.ResourceVariable = {
      id: "0",
      resourceId: "0",
      key: "test",
      value: "test6",
      sensitive: false,
    };

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: null,
        },
        release,
      },
    ];

    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(
      resourceVariable,
    );
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "testb",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test",
                variableSetId: "0",
              },
            ],
          },
        },
        {
          id: "1",
          variableSetId: "1",
          environmentId: "0",
          variableSet: {
            id: "1",
            name: "testa",
            description: null,
            systemId: "0",
            values: [
              {
                id: "1",
                value: "test5",
                key: "test",
                variableSetId: "1",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual("test6");
  });

  it("should prioritize resource variable if it exists and return sensitive value if it is", async () => {
    vi.mocked(utils.getJob).mockResolvedValue(job);

    const resourceVariable: SCHEMA.ResourceVariable = {
      id: "0",
      resourceId: "0",
      key: "test",
      value: "test6",
      sensitive: true,
    };

    const variables: variable[] = [
      {
        deployment_variable: {
          id: "0",
          config: { type: "string", inputType: "text" },
          description: "test",
          deploymentId: "0",
          key: "test",
          defaultValueId: null,
        },
        release,
      },
    ];

    vi.mocked(utils.getResourceVariableValue).mockResolvedValue(
      resourceVariable,
    );
    vi.mocked(utils.getDeploymentVariables).mockResolvedValue(variables);
    vi.mocked(utils.getResource).mockResolvedValue(resource);

    vi.mocked(utils.getVariableValues).mockResolvedValue(variableValues);
    vi.mocked(utils.getFirstMatchedResource).mockResolvedValue(undefined);

    vi.mocked(utils.getEnvironment).mockResolvedValue({
      id: "0",
      name: "test",
      description: null,
      systemId: "0",
      policyId: null,
      resourceFilter: null,
      createdAt: new Date(),
      environments: [
        {
          id: "0",
          variableSetId: "0",
          environmentId: "0",
          variableSet: {
            id: "0",
            name: "testb",
            description: null,
            systemId: "0",
            values: [
              {
                id: "0",
                value: "test4",
                key: "test",
                variableSetId: "0",
              },
            ],
          },
        },
        {
          id: "1",
          variableSetId: "1",
          environmentId: "0",
          variableSet: {
            id: "1",
            name: "testa",
            description: null,
            systemId: "0",
            values: [
              {
                id: "1",
                value: "test5",
                key: "test",
                variableSetId: "1",
              },
            ],
          },
        },
      ],
    });

    const result = await jobVariablesDeployment.determineVariablesForReleaseJob(
      db,
      {
        ...job.job,
        releaseJobTrigger: job.release_job_trigger,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toEqual("test6");
    expect(result[0]!.sensitive).toBe(true);
  });
});
