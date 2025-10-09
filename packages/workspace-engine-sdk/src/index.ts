import createOClient, { ClientOptions } from "openapi-fetch";

import { operations, paths } from "./schema";

export { operations as Operations } from "./schema";

export function createClient(options: ClientOptions & { apiKey: string }) {
  return createOClient<paths>({
    baseUrl: options.baseUrl ?? "https://app.ctrlplane.com",
    ...options,
    fetch: (input: Request) => {
      const url = new URL(input.url);
      url.pathname = `/api${url.pathname}`;
      return fetch(new Request(url.toString(), input));
    },
    headers: { "x-api-key": options?.apiKey },
  });
}
/**
 * Class for managing target providers in the Ctrlplane API
 */
export class ResourceProvider {
  /**
   * Creates a new TargetProvider instance
   * @param options - Configuration options
   * @param options.workspaceId - ID of the workspace
   * @param options.name - Name of the target provider
   * @param client - API client instance
   */
  constructor(
    private options: { workspaceId: string; name: string },
    private client: ReturnType<typeof createClient>,
  ) {}

  private provider:
    | operations["upsertResourceProvider"]["responses"]["200"]["content"]["application/json"]
    | null = null;

  /**
   * Gets the resource provider details, caching the result
   * @returns The resource provider details
   */
  async get() {
    if (this.provider != null) {
      return this.provider;
    }

    const { data } = await this.client.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      { params: { path: this.options } },
    );
    this.provider = data;
    return this.provider;
  }

  /**
   * Sets the resources for this provider
   * @param resources - Array of resources to set
   * @returns The API response
   * @throws Error if the scanner is not found
   */
  async set(
    resources: operations["setResourceProvidersResources"]["requestBody"]["content"]["application/json"]["resources"],
  ) {
    const scanner = await this.get();
    if (scanner == null) throw new Error("Scanner not found");

    return this.client.PATCH("/v1/resource-providers/{providerId}/set", {
      params: { path: { providerId: scanner.id } },
      body: { resources: uniqBy(resources, (t) => t.identifier) },
    });
  }
}

export class JobAgent {
  constructor(
    private options: { type: string; workspaceId: string; name: string },
    private client: ReturnType<typeof createClient>,
  ) {}

  private agent:
    | operations["upsertJobAgent"]["responses"]["200"]["content"]["application/json"]
    | null = null;

  async get() {
    if (this.agent != null) {
      return this.agent;
    }

    const { data } = await this.client.PATCH("/v1/job-agents/name", {
      body: this.options,
    });
    this.agent = data;
    return this.agent;
  }

  async next() {
    const { data } = await this.client.GET(
      "/v1/job-agents/{agentId}/queue/next",
      { params: { path: { agentId: this.agent.id } } },
    );
    return data.jobs.map((job) => new Job(job, this.client)) ?? [];
  }

  async running() {
    const { data } = await this.client.GET(
      "/v1/job-agents/{agentId}/jobs/running",
      { params: { path: { agentId: this.agent.id } } },
    );
    return data.jobs.map((job) => new Job(job, this.client)) ?? [];
  }
}

export class Job {
  constructor(
    private job: { id: string },
    private client: ReturnType<typeof createClient>,
  ) {}

  acknowledge() {
    return this.client.POST("/v1/jobs/{jobId}/acknowledge", {
      params: { path: { jobId: this.job.id } },
    });
  }

  get() {
    return this.client
      .GET("/v1/jobs/{jobId}", {
        params: { path: { jobId: this.job.id } },
      })
      .then(({ data }) => data);
  }

  update(
    update: operations["updateJob"]["requestBody"]["content"]["application/json"],
  ) {
    return this.client.PATCH("/v1/jobs/{jobId}", {
      params: { path: { jobId: this.job.id } },
      body: update,
    });
  }
}

function uniqBy<T>(arr: T[], iteratee: (item: T) => any): T[] {
  const seen = new Map<any, boolean>();
  return arr.filter((item) => {
    const key = iteratee(item);
    if (seen.has(key)) {
      return false;
    }
    seen.set(key, true);
    return true;
  });
}
