/* tslint:disable */
/* eslint-disable */
/**
 * Ctrlplane API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import type {
  AcknowledgeJob200Response,
  GetAgentRunningExecutions200ResponseInner,
  GetJob200Response,
  GetNextJobs200Response,
  SetTargetProvidersTargetsRequest,
  UpdateJob200Response,
  UpdateJobAgent200Response,
  UpdateJobAgentRequest,
  UpdateJobRequest,
} from "../models/index";
import {
  AcknowledgeJob200ResponseFromJSON,
  AcknowledgeJob200ResponseToJSON,
  GetAgentRunningExecutions200ResponseInnerFromJSON,
  GetAgentRunningExecutions200ResponseInnerToJSON,
  GetJob200ResponseFromJSON,
  GetJob200ResponseToJSON,
  GetNextJobs200ResponseFromJSON,
  GetNextJobs200ResponseToJSON,
  SetTargetProvidersTargetsRequestFromJSON,
  SetTargetProvidersTargetsRequestToJSON,
  UpdateJob200ResponseFromJSON,
  UpdateJob200ResponseToJSON,
  UpdateJobAgent200ResponseFromJSON,
  UpdateJobAgent200ResponseToJSON,
  UpdateJobAgentRequestFromJSON,
  UpdateJobAgentRequestToJSON,
  UpdateJobRequestFromJSON,
  UpdateJobRequestToJSON,
} from "../models/index";
import * as runtime from "../runtime";

export interface AcknowledgeJobRequest {
  executionId: string;
}

export interface GetAgentRunningExecutionsRequest {
  agentId: string;
}

export interface GetJobRequest {
  executionId: string;
}

export interface GetNextJobsRequest {
  agentId: string;
}

export interface SetTargetProvidersTargetsOperationRequest {
  providerId: string;
  setTargetProvidersTargetsRequest: SetTargetProvidersTargetsRequest;
}

export interface UpdateJobOperationRequest {
  executionId: string;
  updateJobRequest: UpdateJobRequest;
}

export interface UpdateJobAgentOperationRequest {
  workspace: string;
  updateJobAgentRequest: UpdateJobAgentRequest;
}

export interface UpsertTargetProviderRequest {
  workspace: string;
  name: string;
}

/**
 *
 */
export class DefaultApi extends runtime.BaseAPI {
  /**
   * Acknowledge a job
   */
  async acknowledgeJobRaw(
    requestParameters: AcknowledgeJobRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<AcknowledgeJob200Response>> {
    if (requestParameters["executionId"] == null) {
      throw new runtime.RequiredError(
        "executionId",
        'Required parameter "executionId" was null or undefined when calling acknowledgeJob().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/job/executions/{executionId}/acknowledge`.replace(
          `{${"executionId"}}`,
          encodeURIComponent(String(requestParameters["executionId"])),
        ),
        method: "POST",
        headers: headerParameters,
        query: queryParameters,
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      AcknowledgeJob200ResponseFromJSON(jsonValue),
    );
  }

  /**
   * Acknowledge a job
   */
  async acknowledgeJob(
    requestParameters: AcknowledgeJobRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<AcknowledgeJob200Response> {
    const response = await this.acknowledgeJobRaw(
      requestParameters,
      initOverrides,
    );
    return await response.value();
  }

  /**
   * Get a running agents execution
   */
  async getAgentRunningExecutionsRaw(
    requestParameters: GetAgentRunningExecutionsRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<
    runtime.ApiResponse<Array<GetAgentRunningExecutions200ResponseInner>>
  > {
    if (requestParameters["agentId"] == null) {
      throw new runtime.RequiredError(
        "agentId",
        'Required parameter "agentId" was null or undefined when calling getAgentRunningExecutions().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/job/agents/{agentId}/executions/running`.replace(
          `{${"agentId"}}`,
          encodeURIComponent(String(requestParameters["agentId"])),
        ),
        method: "GET",
        headers: headerParameters,
        query: queryParameters,
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      jsonValue.map(GetAgentRunningExecutions200ResponseInnerFromJSON),
    );
  }

  /**
   * Get a running agents execution
   */
  async getAgentRunningExecutions(
    requestParameters: GetAgentRunningExecutionsRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<Array<GetAgentRunningExecutions200ResponseInner>> {
    const response = await this.getAgentRunningExecutionsRaw(
      requestParameters,
      initOverrides,
    );
    return await response.value();
  }

  /**
   * Get a job
   */
  async getJobRaw(
    requestParameters: GetJobRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<GetJob200Response>> {
    if (requestParameters["executionId"] == null) {
      throw new runtime.RequiredError(
        "executionId",
        'Required parameter "executionId" was null or undefined when calling getJob().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/job/executions/{executionId}`.replace(
          `{${"executionId"}}`,
          encodeURIComponent(String(requestParameters["executionId"])),
        ),
        method: "GET",
        headers: headerParameters,
        query: queryParameters,
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      GetJob200ResponseFromJSON(jsonValue),
    );
  }

  /**
   * Get a job
   */
  async getJob(
    requestParameters: GetJobRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<GetJob200Response> {
    const response = await this.getJobRaw(requestParameters, initOverrides);
    return await response.value();
  }

  /**
   * Get the next jobs
   */
  async getNextJobsRaw(
    requestParameters: GetNextJobsRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<GetNextJobs200Response>> {
    if (requestParameters["agentId"] == null) {
      throw new runtime.RequiredError(
        "agentId",
        'Required parameter "agentId" was null or undefined when calling getNextJobs().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/job/agents/{agentId}/queue/next`.replace(
          `{${"agentId"}}`,
          encodeURIComponent(String(requestParameters["agentId"])),
        ),
        method: "GET",
        headers: headerParameters,
        query: queryParameters,
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      GetNextJobs200ResponseFromJSON(jsonValue),
    );
  }

  /**
   * Get the next jobs
   */
  async getNextJobs(
    requestParameters: GetNextJobsRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<GetNextJobs200Response> {
    const response = await this.getNextJobsRaw(
      requestParameters,
      initOverrides,
    );
    return await response.value();
  }

  /**
   * Sets the target for a provider.
   */
  async setTargetProvidersTargetsRaw(
    requestParameters: SetTargetProvidersTargetsOperationRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<void>> {
    if (requestParameters["providerId"] == null) {
      throw new runtime.RequiredError(
        "providerId",
        'Required parameter "providerId" was null or undefined when calling setTargetProvidersTargets().',
      );
    }

    if (requestParameters["setTargetProvidersTargetsRequest"] == null) {
      throw new runtime.RequiredError(
        "setTargetProvidersTargetsRequest",
        'Required parameter "setTargetProvidersTargetsRequest" was null or undefined when calling setTargetProvidersTargets().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    headerParameters["Content-Type"] = "application/json";

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/target-provider/{providerId}/set`.replace(
          `{${"providerId"}}`,
          encodeURIComponent(String(requestParameters["providerId"])),
        ),
        method: "PATCH",
        headers: headerParameters,
        query: queryParameters,
        body: SetTargetProvidersTargetsRequestToJSON(
          requestParameters["setTargetProvidersTargetsRequest"],
        ),
      },
      initOverrides,
    );

    return new runtime.VoidApiResponse(response);
  }

  /**
   * Sets the target for a provider.
   */
  async setTargetProvidersTargets(
    requestParameters: SetTargetProvidersTargetsOperationRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<void> {
    await this.setTargetProvidersTargetsRaw(requestParameters, initOverrides);
  }

  /**
   * Update a job
   */
  async updateJobRaw(
    requestParameters: UpdateJobOperationRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<UpdateJob200Response>> {
    if (requestParameters["executionId"] == null) {
      throw new runtime.RequiredError(
        "executionId",
        'Required parameter "executionId" was null or undefined when calling updateJob().',
      );
    }

    if (requestParameters["updateJobRequest"] == null) {
      throw new runtime.RequiredError(
        "updateJobRequest",
        'Required parameter "updateJobRequest" was null or undefined when calling updateJob().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    headerParameters["Content-Type"] = "application/json";

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/job/executions/{executionId}`.replace(
          `{${"executionId"}}`,
          encodeURIComponent(String(requestParameters["executionId"])),
        ),
        method: "PATCH",
        headers: headerParameters,
        query: queryParameters,
        body: UpdateJobRequestToJSON(requestParameters["updateJobRequest"]),
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      UpdateJob200ResponseFromJSON(jsonValue),
    );
  }

  /**
   * Update a job
   */
  async updateJob(
    requestParameters: UpdateJobOperationRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<UpdateJob200Response> {
    const response = await this.updateJobRaw(requestParameters, initOverrides);
    return await response.value();
  }

  /**
   * Upserts the agent
   */
  async updateJobAgentRaw(
    requestParameters: UpdateJobAgentOperationRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<UpdateJobAgent200Response>> {
    if (requestParameters["workspace"] == null) {
      throw new runtime.RequiredError(
        "workspace",
        'Required parameter "workspace" was null or undefined when calling updateJobAgent().',
      );
    }

    if (requestParameters["updateJobAgentRequest"] == null) {
      throw new runtime.RequiredError(
        "updateJobAgentRequest",
        'Required parameter "updateJobAgentRequest" was null or undefined when calling updateJobAgent().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    headerParameters["Content-Type"] = "application/json";

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/{workspace}/job/agent/name`.replace(
          `{${"workspace"}}`,
          encodeURIComponent(String(requestParameters["workspace"])),
        ),
        method: "PATCH",
        headers: headerParameters,
        query: queryParameters,
        body: UpdateJobAgentRequestToJSON(
          requestParameters["updateJobAgentRequest"],
        ),
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      UpdateJobAgent200ResponseFromJSON(jsonValue),
    );
  }

  /**
   * Upserts the agent
   */
  async updateJobAgent(
    requestParameters: UpdateJobAgentOperationRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<UpdateJobAgent200Response> {
    const response = await this.updateJobAgentRaw(
      requestParameters,
      initOverrides,
    );
    return await response.value();
  }

  /**
   * Upserts a target provider.
   */
  async upsertTargetProviderRaw(
    requestParameters: UpsertTargetProviderRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<runtime.ApiResponse<UpdateJobAgent200Response>> {
    if (requestParameters["workspace"] == null) {
      throw new runtime.RequiredError(
        "workspace",
        'Required parameter "workspace" was null or undefined when calling upsertTargetProvider().',
      );
    }

    if (requestParameters["name"] == null) {
      throw new runtime.RequiredError(
        "name",
        'Required parameter "name" was null or undefined when calling upsertTargetProvider().',
      );
    }

    const queryParameters: any = {};

    const headerParameters: runtime.HTTPHeaders = {};

    if (this.configuration && this.configuration.apiKey) {
      headerParameters["x-api-key"] =
        await this.configuration.apiKey("x-api-key"); // apiKey authentication
    }

    const response = await this.request(
      {
        path: `/v1/{workspace}/target-provider/name/{name}`
          .replace(
            `{${"workspace"}}`,
            encodeURIComponent(String(requestParameters["workspace"])),
          )
          .replace(
            `{${"name"}}`,
            encodeURIComponent(String(requestParameters["name"])),
          ),
        method: "GET",
        headers: headerParameters,
        query: queryParameters,
      },
      initOverrides,
    );

    return new runtime.JSONApiResponse(response, (jsonValue) =>
      UpdateJobAgent200ResponseFromJSON(jsonValue),
    );
  }

  /**
   * Upserts a target provider.
   */
  async upsertTargetProvider(
    requestParameters: UpsertTargetProviderRequest,
    initOverrides?: RequestInit | runtime.InitOverrideFunction,
  ): Promise<UpdateJobAgent200Response> {
    const response = await this.upsertTargetProviderRaw(
      requestParameters,
      initOverrides,
    );
    return await response.value();
  }
}
