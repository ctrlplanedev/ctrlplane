# Ctrlplane API Bash client

## Overview

This is a Bash client script for accessing Ctrlplane API service.

The script uses cURL underneath for making all REST calls.

## Usage

```shell
# Make sure the script has executable rights
$ chmod u+x 

# Print the list of operations available on the service
$ ./ -h

# Print the service description
$ ./ --about

# Print detailed information about specific operation
$ ./ <operationId> -h

# Make GET request
./ --host http://<hostname>:<port> --accept xml <operationId> <queryParam1>=<value1> <header_key1>:<header_value2>

# Make GET request using arbitrary curl options (must be passed before <operationId>) to an SSL service using username:password
 -k -sS --tlsv1.2 --host https://<hostname> -u <user>:<password> --accept xml <operationId> <queryParam1>=<value1> <header_key1>:<header_value2>

# Make POST request
$ echo '<body_content>' |  --host <hostname> --content-type json <operationId> -

# Make POST request with simple JSON content, e.g.:
# {
#   "key1": "value1",
#   "key2": "value2",
#   "key3": 23
# }
$ echo '<body_content>' |  --host <hostname> --content-type json <operationId> key1==value1 key2=value2 key3:=23 -

# Make POST request with form data
$  --host <hostname> <operationId> key1:=value1 key2:=value2 key3:=23

# Preview the cURL command without actually executing it
$  --host http://<hostname>:<port> --dry-run <operationid>

```

## Docker image

You can easily create a Docker image containing a preconfigured environment
for using the REST Bash client including working autocompletion and short
welcome message with basic instructions, using the generated Dockerfile:

```shell
docker build -t my-rest-client .
docker run -it my-rest-client
```

By default you will be logged into a Zsh environment which has much more
advanced auto completion, but you can switch to Bash, where basic autocompletion
is also available.

## Shell completion

### Bash

The generated bash-completion script can be either directly loaded to the current Bash session using:

```shell
source .bash-completion
```

Alternatively, the script can be copied to the `/etc/bash-completion.d` (or on OSX with Homebrew to `/usr/local/etc/bash-completion.d`):

```shell
sudo cp .bash-completion /etc/bash-completion.d/
```

#### OS X

On OSX you might need to install bash-completion using Homebrew:

```shell
brew install bash-completion
```

and add the following to the `~/.bashrc`:

```shell
if [ -f $(brew --prefix)/etc/bash_completion ]; then
  . $(brew --prefix)/etc/bash_completion
fi
```

### Zsh

In Zsh, the generated `_` Zsh completion file must be copied to one of the folders under `$FPATH` variable.

## Documentation for API Endpoints

All URIs are relative to **

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*DefaultApi* | [**acknowledgeAgentJob**](docs/DefaultApi.md#acknowledgeagentjob) | **POST** /v1/job-agents/{agentId}/queue/acknowledge | Acknowledge a job for an agent
*DefaultApi* | [**acknowledgeJob**](docs/DefaultApi.md#acknowledgejob) | **POST** /v1/jobs/{jobId}/acknowledge | Acknowledge a job
*DefaultApi* | [**createEnvironment**](docs/DefaultApi.md#createenvironment) | **POST** /v1/environments | Create an environment
*DefaultApi* | [**createRelease**](docs/DefaultApi.md#createrelease) | **POST** /v1/releases | Creates a release
*DefaultApi* | [**createReleaseChannel**](docs/DefaultApi.md#createreleasechannel) | **POST** /v1/release-channels | Create a release channel
*DefaultApi* | [**deleteTarget**](docs/DefaultApi.md#deletetarget) | **DELETE** /v1/targets/{targetId} | Delete a target
*DefaultApi* | [**deleteTargetByIdentifier**](docs/DefaultApi.md#deletetargetbyidentifier) | **DELETE** /v1/workspaces/{workspaceId}/targets/identifier/{identifier} | Delete a target by identifier
*DefaultApi* | [**getAgentRunningJob**](docs/DefaultApi.md#getagentrunningjob) | **GET** /v1/job-agents/{agentId}/jobs/running | Get a agents running jobs
*DefaultApi* | [**getJob**](docs/DefaultApi.md#getjob) | **GET** /v1/jobs/{jobId} | Get a job
*DefaultApi* | [**getNextJobs**](docs/DefaultApi.md#getnextjobs) | **GET** /v1/job-agents/{agentId}/queue/next | Get the next jobs
*DefaultApi* | [**getTarget**](docs/DefaultApi.md#gettarget) | **GET** /v1/targets/{targetId} | Get a target
*DefaultApi* | [**getTargetByIdentifier**](docs/DefaultApi.md#gettargetbyidentifier) | **GET** /v1/workspaces/{workspaceId}/targets/identifier/{identifier} | Get a target by identifier
*DefaultApi* | [**setTargetProvidersTargets**](docs/DefaultApi.md#settargetproviderstargets) | **PATCH** /v1/target-providers/{providerId}/set | Sets the target for a provider.
*DefaultApi* | [**updateJob**](docs/DefaultApi.md#updatejob) | **PATCH** /v1/jobs/{jobId} | Update a job
*DefaultApi* | [**updateJobAgent**](docs/DefaultApi.md#updatejobagent) | **PATCH** /v1/job-agents/name | Upserts the agent
*DefaultApi* | [**updateTarget**](docs/DefaultApi.md#updatetarget) | **PATCH** /v1/targets/{targetId} | Update a target
*DefaultApi* | [**upsertTargetProvider**](docs/DefaultApi.md#upserttargetprovider) | **GET** /v1/workspaces/{workspaceId}/target-providers/name/{name} | Upserts a target provider.
*DefaultApi* | [**upsertTargets**](docs/DefaultApi.md#upserttargets) | **POST** /v1/targets | Create or update multiple targets


## Documentation For Models

 - [AcknowledgeAgentJob200Response](docs/AcknowledgeAgentJob200Response.md)
 - [AcknowledgeAgentJob401Response](docs/AcknowledgeAgentJob401Response.md)
 - [AcknowledgeJob200Response](docs/AcknowledgeJob200Response.md)
 - [CreateEnvironment200Response](docs/CreateEnvironment200Response.md)
 - [CreateEnvironment200ResponseEnvironment](docs/CreateEnvironment200ResponseEnvironment.md)
 - [CreateEnvironment409Response](docs/CreateEnvironment409Response.md)
 - [CreateEnvironmentRequest](docs/CreateEnvironmentRequest.md)
 - [CreateEnvironmentRequestReleaseChannelsInner](docs/CreateEnvironmentRequestReleaseChannelsInner.md)
 - [CreateRelease200Response](docs/CreateRelease200Response.md)
 - [CreateReleaseChannel200Response](docs/CreateReleaseChannel200Response.md)
 - [CreateReleaseChannel401Response](docs/CreateReleaseChannel401Response.md)
 - [CreateReleaseChannel409Response](docs/CreateReleaseChannel409Response.md)
 - [CreateReleaseChannelRequest](docs/CreateReleaseChannelRequest.md)
 - [CreateReleaseRequest](docs/CreateReleaseRequest.md)
 - [DeleteTarget200Response](docs/DeleteTarget200Response.md)
 - [DeleteTargetByIdentifier200Response](docs/DeleteTargetByIdentifier200Response.md)
 - [GetAgentRunningJob200ResponseInner](docs/GetAgentRunningJob200ResponseInner.md)
 - [GetJob200Response](docs/GetJob200Response.md)
 - [GetJob200ResponseApproval](docs/GetJob200ResponseApproval.md)
 - [GetJob200ResponseApprovalApprover](docs/GetJob200ResponseApprovalApprover.md)
 - [GetJob200ResponseDeployment](docs/GetJob200ResponseDeployment.md)
 - [GetJob200ResponseEnvironment](docs/GetJob200ResponseEnvironment.md)
 - [GetJob200ResponseRelease](docs/GetJob200ResponseRelease.md)
 - [GetJob200ResponseRunbook](docs/GetJob200ResponseRunbook.md)
 - [GetJob200ResponseTarget](docs/GetJob200ResponseTarget.md)
 - [GetNextJobs200Response](docs/GetNextJobs200Response.md)
 - [GetNextJobs200ResponseJobsInner](docs/GetNextJobs200ResponseJobsInner.md)
 - [GetTarget200Response](docs/GetTarget200Response.md)
 - [GetTarget200ResponseProvider](docs/GetTarget200ResponseProvider.md)
 - [GetTarget200ResponseVariablesInner](docs/GetTarget200ResponseVariablesInner.md)
 - [GetTarget404Response](docs/GetTarget404Response.md)
 - [GetTargetByIdentifier200Response](docs/GetTargetByIdentifier200Response.md)
 - [GetTargetByIdentifier200ResponseProvider](docs/GetTargetByIdentifier200ResponseProvider.md)
 - [GetTargetByIdentifier200ResponseVariablesInner](docs/GetTargetByIdentifier200ResponseVariablesInner.md)
 - [GetTargetByIdentifier404Response](docs/GetTargetByIdentifier404Response.md)
 - [SetTargetProvidersTargetsRequest](docs/SetTargetProvidersTargetsRequest.md)
 - [SetTargetProvidersTargetsRequestTargetsInner](docs/SetTargetProvidersTargetsRequestTargetsInner.md)
 - [UpdateJob200Response](docs/UpdateJob200Response.md)
 - [UpdateJobAgent200Response](docs/UpdateJobAgent200Response.md)
 - [UpdateJobAgentRequest](docs/UpdateJobAgentRequest.md)
 - [UpdateJobRequest](docs/UpdateJobRequest.md)
 - [UpdateTarget200Response](docs/UpdateTarget200Response.md)
 - [UpdateTargetRequest](docs/UpdateTargetRequest.md)
 - [UpsertTargetsRequest](docs/UpsertTargetsRequest.md)
 - [UpsertTargetsRequestTargetsInner](docs/UpsertTargetsRequestTargetsInner.md)
 - [UpsertTargetsRequestTargetsInnerVariablesInner](docs/UpsertTargetsRequestTargetsInnerVariablesInner.md)
 - [UpsertTargetsRequestTargetsInnerVariablesInnerValue](docs/UpsertTargetsRequestTargetsInnerVariablesInnerValue.md)


## Documentation For Authorization


## apiKey


- **Type**: API key
- **API key parameter name**: x-api-key
- **Location**: HTTP header

