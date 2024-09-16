import { beforeEach, describe, expect, it, vi } from "vitest";

import { listVariables, listWorkspaces } from "../api.js";

const fetchMock = vi.fn();
global.fetch = fetchMock;

vi.mock("../config.js", () => ({
  env: {
    TFE_TOKEN: "mock-token",
    TFE_API_URL: "https://mock.api.url",
    TFE_ORGANIZATION: "mock-organization",
    CTRLPLANE_API_URL: "https://mock.ctrlplane.url",
    CTRLPLANE_API_KEY: "mock-api-key",
    CTRLPLANE_WORKSPACE: "mock-workspace",
    CRON_ENABLED: false,
    CRON_TIME: "*/5 * * * *",
  },
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.resetAllMocks();
});

describe("API Module", () => {
  describe("listWorkspaces", () => {
    it("should return a list of workspaces", async () => {
      const mockWorkspaces = {
        data: [
          {
            id: "workspace-1",
            type: "workspaces",
            attributes: { name: "Workspace One" },
          },
          {
            id: "workspace-2",
            type: "workspaces",
            attributes: { name: "Workspace Two" },
          },
        ],
        links: {},
      };

      // Mock the fetch response
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockWorkspaces), {
          status: 200,
          headers: { "Content-Type": "application/vnd.api+json" },
        }),
      );

      // Call the function under test
      const workspaces = await listWorkspaces();

      // Assertions
      expect(workspaces).toEqual(mockWorkspaces.data);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://mock.api.url/organizations/mock-organization/workspaces",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer mock-token`,
            "Content-Type": "application/vnd.api+json",
            Accept: "application/vnd.api+json",
          }),
        }),
      );
    });
  });

  describe("listVariables", () => {
    it("should return a list of variables for a workspace", async () => {
      const workspaceId = "workspace-1";
      const mockVariables = {
        data: [
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
        ],
        links: {},
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockVariables), {
          status: 200,
          headers: { "Content-Type": "application/vnd.api+json" },
        }),
      );

      const variables = await listVariables(workspaceId);

      expect(variables).toEqual(mockVariables.data);
      expect(fetchMock).toHaveBeenCalledWith(
        `https://mock.api.url/workspaces/${workspaceId}/vars`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer mock-token`,
            "Content-Type": "application/vnd.api+json",
            Accept: "application/vnd.api+json",
          }),
        }),
      );
    });

    it("should handle pagination correctly", async () => {
      const workspaceId = "workspace-1";
      const mockVariablesPage1 = {
        data: [
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
        ],
        links: {
          next: `https://mock.api.url/workspaces/${workspaceId}/vars?page=2`,
        },
      };
      const mockVariablesPage2 = {
        data: [
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
        ],
        links: {},
      };

      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockVariablesPage1), {
            status: 200,
            headers: { "Content-Type": "application/vnd.api+json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockVariablesPage2), {
            status: 200,
            headers: { "Content-Type": "application/vnd.api+json" },
          }),
        );

      const variables = await listVariables(workspaceId);

      expect(variables).toEqual([
        ...mockVariablesPage1.data,
        ...mockVariablesPage2.data,
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        `https://mock.api.url/workspaces/${workspaceId}/vars`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer mock-token`,
            "Content-Type": "application/vnd.api+json",
            Accept: "application/vnd.api+json",
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        `https://mock.api.url/workspaces/${workspaceId}/vars?page=2`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer mock-token`,
            "Content-Type": "application/vnd.api+json",
            Accept: "application/vnd.api+json",
          }),
        }),
      );
    });
  });
});
