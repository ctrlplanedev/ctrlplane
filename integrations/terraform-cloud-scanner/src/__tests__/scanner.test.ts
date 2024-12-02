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
    CTRLPLANE_WORKSPACE_ID: "36427c59-e2bd-4b3f-bf54-54404ef6aa0e",
    CTRLPLANE_WORKSPACE_RESOURCE_NAME: "mock-workspace-resource-name",
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
  it("should successfully scan and register resources", async () => {
    vi.spyOn(env, "TFE_ORGANIZATION", "get").mockReturnValue("mock-org");
    vi.spyOn(env, "CTRLPLANE_WORKSPACE_ID", "get").mockReturnValue(
      "36427c59-e2bd-4b3f-bf54-54404ef6aa0e",
    );
    vi.spyOn(env, "CTRLPLANE_SCANNER_NAME", "get").mockReturnValue(
      "mock-scanner",
    );
    vi.spyOn(env, "CTRLPLANE_WORKSPACE_RESOURCE_NAME", "get").mockReturnValue(
      "{{workspace.attributes.name}}",
    );

    const mockWorkspaces = [
      {
        id: "workspace-1",
        type: "workspaces",
        attributes: {
          name: "Workspace-One",
          "tag-names": ["prod", "env:staging"],
          "auto-apply": true,
          "terraform-version": "1.0.0",
          "vcs-repo": {
            identifier: "org/repo",
            branch: "main",
            "repository-http-url": "https://github.com/org/repo",
          },
        },
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
    ];

    vi.mocked(listWorkspaces).mockResolvedValue(mockWorkspaces as any);
    vi.mocked(listVariables).mockResolvedValue(mockVariables as any);

    vi.spyOn(api, "GET").mockResolvedValue({
      data: {
        id: "provider-123",
        name: "mock-provider-name",
        workspaceId: "36427c59-e2bd-4b3f-bf54-54404ef6aa0e",
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    });

    const patchMock = vi.spyOn(api, "PATCH").mockResolvedValue({
      data: {
        "application/json": {
          id: "mock-id",
          name: "mock-name",
          workspaceId: "mock-workspace-id",
          kind: "mock-kind",
          identifier: "mock-identifier",
          version: "mock-version",
          config: {},
          metadata: {},
        },
      },
      response: new Response(),
    });

    await scan();

    expect(listWorkspaces).toHaveBeenCalled();
    expect(listVariables).toHaveBeenCalledWith("workspace-1");

    expect(patchMock).toHaveBeenCalledWith(
      "/v1/resource-providers/{providerId}/set",
      expect.objectContaining({
        body: {
          resources: [
            {
              version: "terraform/v1",
              kind: "Workspace",
              name: "mock-workspace-resource-name",
              identifier: "workspace-1",
              config: {
                workspaceId: "workspace-1",
              },
              metadata: {
                "ctrlplane/external-id": "workspace-1",
                "ctrlplane/links":
                  '{"Terraform Workspace":"https://app.terraform.io/app/mock-org/workspaces/Workspace-One"}',
                "terraform-cloud/organization": "mock-org",
                "terraform-cloud/tag/env": "staging",
                "terraform-cloud/tag/prod": "true",
                "terraform-cloud/variables/TF_VAR_example": "example_value",
                "terraform-cloud/vcs-repo/branch": "main",
                "terraform-cloud/vcs-repo/identifier": "org/repo",
                "terraform-cloud/vcs-repo/repository-http-url":
                  "https://github.com/org/repo",
                "terraform-cloud/workspace-auto-apply": "true",
                "terraform-cloud/workspace-name": "Workspace-One",
                "terraform/version": "1.0.0",
              },
            },
          ],
        },
        params: {
          path: {
            providerId: "provider-123",
          },
        },
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      "Successfully registered resources",
    );
  });

  it("should handle scan errors gracefully", async () => {
    vi.mocked(listWorkspaces).mockRejectedValue(new Error("API Error"));

    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    await scan();

    expect(logger.error).toHaveBeenCalledWith(
      "An error occurred during the scan process:",
      expect.any(Error),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
