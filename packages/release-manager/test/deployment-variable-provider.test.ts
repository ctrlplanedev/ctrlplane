import type {
  DeploymentVariable,
  DeploymentVariableValue,
  Resource,
} from "@ctrlplane/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ColumnOperator } from "@ctrlplane/validators/conditions";

import { DatabaseDeploymentVariableProvider } from "../src/index.js";

type Variable = DeploymentVariable & {
  values: DeploymentVariableValue[];
  defaultValue: DeploymentVariableValue | null;
};

const sampleVariable: Variable = {
  id: "var-1",
  key: "var-1",
  description: "",
  config: {
    type: "string",
    inputType: "text",
  },
  defaultValueId: null,
  defaultValue: null,
  deploymentId: "dep-1",
  values: [
    {
      id: "val-1",
      value: "test-1",
      resourceSelector: {
        type: "name",
        operator: ColumnOperator.Equals,
        value: "test",
      },
      variableId: "var-1",
    },
    {
      id: "val-2",
      value: "test-2",
      resourceSelector: {
        type: "name",
        operator: ColumnOperator.Equals,
        value: "test",
      },
      variableId: "var-1",
    },
  ],
};

describe("DeploymentResourceVariableProvider", () => {
  let provider: DatabaseDeploymentVariableProvider;
  const sampleResource: Resource = {
    id: "res-1",
    name: "Test Resource",
    createdAt: new Date(),
    workspaceId: "ws-1",
    config: {},
    kind: "test",
    identifier: "test",
    version: "1",
    providerId: "provider-1",
    lockedAt: null,
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    provider = new DatabaseDeploymentVariableProvider({
      resourceId: "res-1",
      deploymentId: "dep-1",
    });
  });

  it("should return null if the variable is not found", async () => {
    vi.spyOn(provider as any, "getVariables").mockResolvedValue([]);
    const result = await provider.getVariable("var-1");
    expect(result).toBeNull();
  });

  it("should return null if none of the variables match the resource", async () => {
    vi.spyOn(provider as any, "getVariables").mockResolvedValue([
      sampleVariable,
    ]);
    vi.spyOn(provider as any, "getResource").mockResolvedValue(null);
    const result = await provider.getVariable("var-1");
    expect(result).toBeNull();
  });

  it("should return the first variable that matches the resource", async () => {
    vi.spyOn(provider as any, "getVariables").mockResolvedValue([
      sampleVariable,
    ]);
    vi.spyOn(provider as any, "getResource").mockResolvedValue(sampleResource);
    const result = await provider.getVariable("var-1");
    expect(result?.value).toEqual("test-1");
  });

  it("should return the default value if no variables match the resource", async () => {
    const variableWithDefaultValue: Variable = {
      ...sampleVariable,
      defaultValueId: "val-3",
      defaultValue: {
        id: "val-3",
        value: "test-3",
        resourceSelector: null,
        variableId: "var-1",
      },
    };

    vi.spyOn(provider as any, "getVariables").mockResolvedValue([
      variableWithDefaultValue,
    ]);
    vi.spyOn(provider as any, "getResource").mockResolvedValue(null);
    const result = await provider.getVariable("var-1");
    expect(result?.value).toEqual("test-3");
  });
});
