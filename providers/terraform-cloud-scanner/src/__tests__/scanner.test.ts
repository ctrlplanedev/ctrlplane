/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@ctrlplane/logger";

import { listVariables, listWorkspaces } from "../api.js";
import { env } from "../config.js";
import { scan } from "../scanner.js";
import { api } from "../sdk.js";

const fetchMock = vi.fn();
global.fetch = fetchMock;

vi.mock("../api.js");
vi.mock("../sdk.js");
vi.mock("@ctrlplane/logger");

vi.mock("../config.js", () => ({
  env: {
    TFE_TOKEN: "mock-token",
    TFE_API_URL: "https://mock.api.url",
    TFE_ORGANIZATION: "mock-organization",
    CTRLPLANE_API_URL: "https://mock.ctrlplane.url",
    CTRLPLANE_API_KEY: "mock-api-key",
    CTRLPLANE_WORKSPACE: "mock-workspace",
    CTRLPLANE_WORKSPACE_TARGET_NAME: "mock-workspace-target-name",
    CTRLPLANE_SCANNER_NAME: "mock-scanner-name",
    CRON_ENABLED: false,
    CRON_TIME: "*/5 * * * *",
  },
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.resetAllMocks();
});

describe("Scanner Module", () => {
  it("should successfully scan and register targets", async () => {
    vi.spyOn(env, "TFE_ORGANIZATION", "get").mockReturnValue("mock-org");
    vi.spyOn(env, "CTRLPLANE_WORKSPACE", "get").mockReturnValue(
      "ctrlplane-workspace",
    );
    vi.spyOn(env, "CTRLPLANE_SCANNER_NAME", "get").mockReturnValue(
      "mock-scanner",
    );

    const mockWorkspaces = [
      {
        id: "workspace-1",
        type: "workspaces",
        attributes: { name: "Workspace-One", "tag-names": ["prod"] },
      },
    ];

    const mockVariables = [
      {
        id: "var-1",
        type: "vars",
        attributes: {
          key: "TF_VAR_example",
          value: "example_value",
          category: "terraform",
          hcl: false,
          sensitive: false,
        },
      },
      {
        id: "var-2",
        type: "vars",
        attributes: {
          key: "ENV_VAR",
          value: "env_value",
          category: "env",
          hcl: false,
          sensitive: false,
        },
      },
    ];

    const mockProviderId = "provider-123";

    vi.mocked(listWorkspaces).mockResolvedValue(mockWorkspaces as any);
    vi.mocked(listVariables).mockResolvedValue(mockVariables as any);

    vi.spyOn(api, "setTargetProvidersTargets").mockResolvedValue(undefined);
    vi.spyOn(api, "upsertTargetProvider").mockResolvedValue({
      id: mockProviderId,
      name: "mock-provider-name",
      workspaceId: "ctrlplane-workspace",
    });

    await scan();

    expect(() => listVariables("workspace-1")).not.toThrow();
    expect(() =>
      api.upsertTargetProvider({
        workspace: "ctrlplane-workspace",
        name: "mock-scanner",
      }),
    ).not.toThrow();

    expect(() => listWorkspaces()).not.toThrow();
    expect(() => listVariables("workspace-1")).not.toThrow();
    expect(() =>
      api.upsertTargetProvider({
        workspace: "ctrlplane-workspace",
        name: "mock-scanner",
      }),
    ).not.toThrow();

    expect(() =>
      api.setTargetProvidersTargets({
        providerId: mockProviderId,
        setTargetProvidersTargetsRequest: {
          targets: [
            {
              version: "terraform/v1",
              kind: "Workspace",
              name: "workspace-Workspace-One",
              identifier: "workspace-1",
              config: {
                workspaceId: "workspace-1",
              },
              metadata: {
                "terraform/organization": "mock-org",
                "terraform/workspace-name": "Workspace-One",
                "var/TF_VAR_example": "example_value",
                "env/ENV_VAR": "env_value",
                "tags/prod": "true",
                "ctrlplane/link": expect.stringContaining(
                  "https://app.terraform.io/app/mock-org/workspaces/Workspace-One",
                ),
              },
            },
          ],
        },
      }),
    ).not.toThrow();

    expect(logger.info).toHaveBeenCalledWith("Successfully registered targets");
  });
});
