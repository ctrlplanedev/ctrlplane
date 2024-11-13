# DefaultApi

All URIs are relative to **

Method | HTTP request | Description
------------- | ------------- | -------------
[**acknowledgeAgentJob**](DefaultApi.md#acknowledgeAgentJob) | **POST** /v1/job-agents/{agentId}/queue/acknowledge | Acknowledge a job for an agent
[**acknowledgeJob**](DefaultApi.md#acknowledgeJob) | **POST** /v1/jobs/{jobId}/acknowledge | Acknowledge a job
[**createEnvironment**](DefaultApi.md#createEnvironment) | **POST** /v1/environments | Create an environment
[**createRelease**](DefaultApi.md#createRelease) | **POST** /v1/releases | Creates a release
[**createReleaseChannel**](DefaultApi.md#createReleaseChannel) | **POST** /v1/release-channels | Create a release channel
[**deleteTarget**](DefaultApi.md#deleteTarget) | **DELETE** /v1/targets/{targetId} | Delete a target
[**deleteTargetByIdentifier**](DefaultApi.md#deleteTargetByIdentifier) | **DELETE** /v1/workspaces/{workspaceId}/targets/identifier/{identifier} | Delete a target by identifier
[**getAgentRunningJob**](DefaultApi.md#getAgentRunningJob) | **GET** /v1/job-agents/{agentId}/jobs/running | Get a agents running jobs
[**getJob**](DefaultApi.md#getJob) | **GET** /v1/jobs/{jobId} | Get a job
[**getNextJobs**](DefaultApi.md#getNextJobs) | **GET** /v1/job-agents/{agentId}/queue/next | Get the next jobs
[**getTarget**](DefaultApi.md#getTarget) | **GET** /v1/targets/{targetId} | Get a target
[**getTargetByIdentifier**](DefaultApi.md#getTargetByIdentifier) | **GET** /v1/workspaces/{workspaceId}/targets/identifier/{identifier} | Get a target by identifier
[**setTargetProvidersTargets**](DefaultApi.md#setTargetProvidersTargets) | **PATCH** /v1/target-providers/{providerId}/set | Sets the target for a provider.
[**updateJob**](DefaultApi.md#updateJob) | **PATCH** /v1/jobs/{jobId} | Update a job
[**updateJobAgent**](DefaultApi.md#updateJobAgent) | **PATCH** /v1/job-agents/name | Upserts the agent
[**updateTarget**](DefaultApi.md#updateTarget) | **PATCH** /v1/targets/{targetId} | Update a target
[**upsertTargetProvider**](DefaultApi.md#upsertTargetProvider) | **GET** /v1/workspaces/{workspaceId}/target-providers/name/{name} | Upserts a target provider.
[**upsertTargets**](DefaultApi.md#upsertTargets) | **POST** /v1/targets | Create or update multiple targets



## acknowledgeAgentJob

Acknowledge a job for an agent

Marks a job as acknowledged by the agent

### Example

```bash
 acknowledgeAgentJob agentId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** | The ID of the job agent | [default to null]

### Return type

[**AcknowledgeAgentJob200Response**](AcknowledgeAgentJob200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## acknowledgeJob

Acknowledge a job

### Example

```bash
 acknowledgeJob jobId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jobId** | **string** | The job ID | [default to null]

### Return type

[**AcknowledgeJob200Response**](AcknowledgeJob200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## createEnvironment

Create an environment

### Example

```bash
 createEnvironment
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createEnvironmentRequest** | [**CreateEnvironmentRequest**](CreateEnvironmentRequest.md) |  |

### Return type

[**CreateEnvironment200Response**](CreateEnvironment200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## createRelease

Creates a release

### Example

```bash
 createRelease
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createReleaseRequest** | [**CreateReleaseRequest**](CreateReleaseRequest.md) |  |

### Return type

[**CreateRelease200Response**](CreateRelease200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## createReleaseChannel

Create a release channel

### Example

```bash
 createReleaseChannel
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createReleaseChannelRequest** | [**CreateReleaseChannelRequest**](CreateReleaseChannelRequest.md) |  |

### Return type

[**CreateReleaseChannel200Response**](CreateReleaseChannel200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## deleteTarget

Delete a target

### Example

```bash
 deleteTarget targetId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetId** | **string** | The target ID | [default to null]

### Return type

[**DeleteTarget200Response**](DeleteTarget200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## deleteTargetByIdentifier

Delete a target by identifier

### Example

```bash
 deleteTargetByIdentifier workspaceId=value identifier=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workspaceId** | **string** | ID of the workspace | [default to null]
 **identifier** | **string** | Identifier of the target | [default to null]

### Return type

[**DeleteTargetByIdentifier200Response**](DeleteTargetByIdentifier200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## getAgentRunningJob

Get a agents running jobs

### Example

```bash
 getAgentRunningJob agentId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** | The execution ID | [default to null]

### Return type

[**array[GetAgentRunningJob200ResponseInner]**](GetAgentRunningJob200ResponseInner.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## getJob

Get a job

### Example

```bash
 getJob jobId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jobId** | **string** | The execution ID | [default to null]

### Return type

[**GetJob200Response**](GetJob200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## getNextJobs

Get the next jobs

### Example

```bash
 getNextJobs agentId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** | The agent ID | [default to null]

### Return type

[**GetNextJobs200Response**](GetNextJobs200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## getTarget

Get a target

### Example

```bash
 getTarget targetId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetId** | **string** | The target ID | [default to null]

### Return type

[**GetTarget200Response**](GetTarget200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## getTargetByIdentifier

Get a target by identifier

### Example

```bash
 getTargetByIdentifier workspaceId=value identifier=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workspaceId** | **string** | ID of the workspace | [default to null]
 **identifier** | **string** | Identifier of the target | [default to null]

### Return type

[**GetTargetByIdentifier200Response**](GetTargetByIdentifier200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## setTargetProvidersTargets

Sets the target for a provider.

### Example

```bash
 setTargetProvidersTargets providerId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **providerId** | **string** | UUID of the scanner | [default to null]
 **setTargetProvidersTargetsRequest** | [**SetTargetProvidersTargetsRequest**](SetTargetProvidersTargetsRequest.md) |  |

### Return type

(empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not Applicable

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## updateJob

Update a job

### Example

```bash
 updateJob jobId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **jobId** | **string** | The execution ID | [default to null]
 **updateJobRequest** | [**UpdateJobRequest**](UpdateJobRequest.md) |  |

### Return type

[**UpdateJob200Response**](UpdateJob200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## updateJobAgent

Upserts the agent

### Example

```bash
 updateJobAgent
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateJobAgentRequest** | [**UpdateJobAgentRequest**](UpdateJobAgentRequest.md) |  |

### Return type

[**UpdateJobAgent200Response**](UpdateJobAgent200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## updateTarget

Update a target

### Example

```bash
 updateTarget targetId=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetId** | **string** |  | [default to null]
 **updateTargetRequest** | [**UpdateTargetRequest**](UpdateTargetRequest.md) |  |

### Return type

[**UpdateTarget200Response**](UpdateTarget200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## upsertTargetProvider

Upserts a target provider.

### Example

```bash
 upsertTargetProvider workspaceId=value name=value
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **workspaceId** | **string** | Name of the workspace | [default to null]
 **name** | **string** | Name of the target provider | [default to null]

### Return type

[**UpdateJobAgent200Response**](UpdateJobAgent200Response.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not Applicable
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## upsertTargets

Create or update multiple targets

### Example

```bash
 upsertTargets
```

### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **upsertTargetsRequest** | [**UpsertTargetsRequest**](UpsertTargetsRequest.md) |  |

### Return type

(empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not Applicable

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

