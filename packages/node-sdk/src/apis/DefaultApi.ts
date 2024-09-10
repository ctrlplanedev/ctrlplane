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


import * as runtime from '../runtime';
import type {
  AcknowledgeJob200Response,
  GetAgentRunningExecutions200ResponseInner,
  GetJobExecution200Response,
  GetNextJobs200Response,
  SetTargetProvidersTargetsRequest,
  UpdateJobAgent200Response,
  UpdateJobAgentRequest,
  UpdateJobExecution200Response,
  UpdateJobExecutionRequest,
} from '../models/index';
import {
    AcknowledgeJob200ResponseFromJSON,
    AcknowledgeJob200ResponseToJSON,
    GetAgentRunningExecutions200ResponseInnerFromJSON,
    GetAgentRunningExecutions200ResponseInnerToJSON,
    GetJobExecution200ResponseFromJSON,
    GetJobExecution200ResponseToJSON,
    GetNextJobs200ResponseFromJSON,
    GetNextJobs200ResponseToJSON,
    SetTargetProvidersTargetsRequestFromJSON,
    SetTargetProvidersTargetsRequestToJSON,
    UpdateJobAgent200ResponseFromJSON,
    UpdateJobAgent200ResponseToJSON,
    UpdateJobAgentRequestFromJSON,
    UpdateJobAgentRequestToJSON,
    UpdateJobExecution200ResponseFromJSON,
    UpdateJobExecution200ResponseToJSON,
    UpdateJobExecutionRequestFromJSON,
    UpdateJobExecutionRequestToJSON,
} from '../models/index';

export interface AcknowledgeJobRequest {
    executionId: string;
}

export interface GetAgentRunningExecutionsRequest {
    agentId: string;
}

export interface GetJobExecutionRequest {
    executionId: string;
}

export interface GetNextJobsRequest {
    agentId: string;
}

export interface SetTargetProvidersTargetsOperationRequest {
    providerId: string;
    setTargetProvidersTargetsRequest: SetTargetProvidersTargetsRequest;
}

export interface UpdateJobAgentOperationRequest {
    workspace: string;
    updateJobAgentRequest: UpdateJobAgentRequest;
}

export interface UpdateJobExecutionOperationRequest {
    executionId: string;
    updateJobExecutionRequest: UpdateJobExecutionRequest;
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
    async acknowledgeJobRaw(requestParameters: AcknowledgeJobRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<AcknowledgeJob200Response>> {
        if (requestParameters['executionId'] == null) {
            throw new runtime.RequiredError(
                'executionId',
                'Required parameter "executionId" was null or undefined when calling acknowledgeJob().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/job/executions/{executionId}/acknowledge`.replace(`{${"executionId"}}`, encodeURIComponent(String(requestParameters['executionId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => AcknowledgeJob200ResponseFromJSON(jsonValue));
    }

    /**
     * Acknowledge a job
     */
    async acknowledgeJob(requestParameters: AcknowledgeJobRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<AcknowledgeJob200Response> {
        const response = await this.acknowledgeJobRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get a running agents execution
     */
    async getAgentRunningExecutionsRaw(requestParameters: GetAgentRunningExecutionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<GetAgentRunningExecutions200ResponseInner>>> {
        if (requestParameters['agentId'] == null) {
            throw new runtime.RequiredError(
                'agentId',
                'Required parameter "agentId" was null or undefined when calling getAgentRunningExecutions().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/job/agents/{agentId}/executions/running`.replace(`{${"agentId"}}`, encodeURIComponent(String(requestParameters['agentId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => jsonValue.map(GetAgentRunningExecutions200ResponseInnerFromJSON));
    }

    /**
     * Get a running agents execution
     */
    async getAgentRunningExecutions(requestParameters: GetAgentRunningExecutionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<GetAgentRunningExecutions200ResponseInner>> {
        const response = await this.getAgentRunningExecutionsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get a job execution
     */
    async getJobExecutionRaw(requestParameters: GetJobExecutionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<GetJobExecution200Response>> {
        if (requestParameters['executionId'] == null) {
            throw new runtime.RequiredError(
                'executionId',
                'Required parameter "executionId" was null or undefined when calling getJobExecution().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/job/executions/{executionId}`.replace(`{${"executionId"}}`, encodeURIComponent(String(requestParameters['executionId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => GetJobExecution200ResponseFromJSON(jsonValue));
    }

    /**
     * Get a job execution
     */
    async getJobExecution(requestParameters: GetJobExecutionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<GetJobExecution200Response> {
        const response = await this.getJobExecutionRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get the next jobs
     */
    async getNextJobsRaw(requestParameters: GetNextJobsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<GetNextJobs200Response>> {
        if (requestParameters['agentId'] == null) {
            throw new runtime.RequiredError(
                'agentId',
                'Required parameter "agentId" was null or undefined when calling getNextJobs().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/job/agents/{agentId}/queue/next`.replace(`{${"agentId"}}`, encodeURIComponent(String(requestParameters['agentId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => GetNextJobs200ResponseFromJSON(jsonValue));
    }

    /**
     * Get the next jobs
     */
    async getNextJobs(requestParameters: GetNextJobsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<GetNextJobs200Response> {
        const response = await this.getNextJobsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Sets the target for a provider.
     */
    async setTargetProvidersTargetsRaw(requestParameters: SetTargetProvidersTargetsOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['providerId'] == null) {
            throw new runtime.RequiredError(
                'providerId',
                'Required parameter "providerId" was null or undefined when calling setTargetProvidersTargets().'
            );
        }

        if (requestParameters['setTargetProvidersTargetsRequest'] == null) {
            throw new runtime.RequiredError(
                'setTargetProvidersTargetsRequest',
                'Required parameter "setTargetProvidersTargetsRequest" was null or undefined when calling setTargetProvidersTargets().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/target-provider/{providerId}/set`.replace(`{${"providerId"}}`, encodeURIComponent(String(requestParameters['providerId']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: SetTargetProvidersTargetsRequestToJSON(requestParameters['setTargetProvidersTargetsRequest']),
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Sets the target for a provider.
     */
    async setTargetProvidersTargets(requestParameters: SetTargetProvidersTargetsOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.setTargetProvidersTargetsRaw(requestParameters, initOverrides);
    }

    /**
     * Upserts the agent
     */
    async updateJobAgentRaw(requestParameters: UpdateJobAgentOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UpdateJobAgent200Response>> {
        if (requestParameters['workspace'] == null) {
            throw new runtime.RequiredError(
                'workspace',
                'Required parameter "workspace" was null or undefined when calling updateJobAgent().'
            );
        }

        if (requestParameters['updateJobAgentRequest'] == null) {
            throw new runtime.RequiredError(
                'updateJobAgentRequest',
                'Required parameter "updateJobAgentRequest" was null or undefined when calling updateJobAgent().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/{workspace}/job/agent/name`.replace(`{${"workspace"}}`, encodeURIComponent(String(requestParameters['workspace']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: UpdateJobAgentRequestToJSON(requestParameters['updateJobAgentRequest']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => UpdateJobAgent200ResponseFromJSON(jsonValue));
    }

    /**
     * Upserts the agent
     */
    async updateJobAgent(requestParameters: UpdateJobAgentOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UpdateJobAgent200Response> {
        const response = await this.updateJobAgentRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update a job execution
     */
    async updateJobExecutionRaw(requestParameters: UpdateJobExecutionOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UpdateJobExecution200Response>> {
        if (requestParameters['executionId'] == null) {
            throw new runtime.RequiredError(
                'executionId',
                'Required parameter "executionId" was null or undefined when calling updateJobExecution().'
            );
        }

        if (requestParameters['updateJobExecutionRequest'] == null) {
            throw new runtime.RequiredError(
                'updateJobExecutionRequest',
                'Required parameter "updateJobExecutionRequest" was null or undefined when calling updateJobExecution().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/job/executions/{executionId}`.replace(`{${"executionId"}}`, encodeURIComponent(String(requestParameters['executionId']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: UpdateJobExecutionRequestToJSON(requestParameters['updateJobExecutionRequest']),
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => UpdateJobExecution200ResponseFromJSON(jsonValue));
    }

    /**
     * Update a job execution
     */
    async updateJobExecution(requestParameters: UpdateJobExecutionOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UpdateJobExecution200Response> {
        const response = await this.updateJobExecutionRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Upserts a target provider.
     */
    async upsertTargetProviderRaw(requestParameters: UpsertTargetProviderRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UpdateJobAgent200Response>> {
        if (requestParameters['workspace'] == null) {
            throw new runtime.RequiredError(
                'workspace',
                'Required parameter "workspace" was null or undefined when calling upsertTargetProvider().'
            );
        }

        if (requestParameters['name'] == null) {
            throw new runtime.RequiredError(
                'name',
                'Required parameter "name" was null or undefined when calling upsertTargetProvider().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.apiKey) {
            headerParameters["x-api-key"] = await this.configuration.apiKey("x-api-key"); // apiKey authentication
        }

        const response = await this.request({
            path: `/v1/{workspace}/target-provider/name/{name}`.replace(`{${"workspace"}}`, encodeURIComponent(String(requestParameters['workspace']))).replace(`{${"name"}}`, encodeURIComponent(String(requestParameters['name']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response, (jsonValue) => UpdateJobAgent200ResponseFromJSON(jsonValue));
    }

    /**
     * Upserts a target provider.
     */
    async upsertTargetProvider(requestParameters: UpsertTargetProviderRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UpdateJobAgent200Response> {
        const response = await this.upsertTargetProviderRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
