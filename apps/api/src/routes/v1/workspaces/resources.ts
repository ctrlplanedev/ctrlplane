import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const listResources: AsyncTypedHandler<
    "/v1/workspaces/{workspaceId}/resources",
    "get"
> = async (req, res) => {
    const { workspaceId } = req.params;
    const { limit, offset, cel } = req.query;

    const decodedCel =
        typeof cel === "string" ? decodeURIComponent(cel.replace(/\+/g, " ")) : cel;

    const result = await getClientFor(workspaceId).POST(
        "/v1/workspaces/{workspaceId}/resources/query",
        {
            body: {
                filter: decodedCel != null ? { cel: decodedCel } : undefined,
            },
            params: {
                path: { workspaceId },
                query: { limit, offset },
            },
        },
    );

    if (result.error != null)
        throw new ApiError(
            result.error.error ?? "Failed to list resources",
            result.response.status,
        );

    res.status(200).json(result.data);
};

const getResourceByIdentifier: AsyncTypedHandler<
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
    "get"
> = async (req, res) => {
    const { workspaceId, identifier } = req.params;

    const resourceIdentifier = encodeURIComponent(identifier);
    const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
        { params: { path: { workspaceId, resourceIdentifier } } },
    );

    if (result.error != null)
        throw new ApiError(
            result.error.error ?? "Resource not found",
            result.response.status,
        );

    res.status(200).json(result.data);
};

const deleteResourceByIdentifier: AsyncTypedHandler<
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
    "delete"
> = async (req, res) => {
    const { workspaceId, identifier } = req.params;

    const resourceIdentifier = encodeURIComponent(identifier);
    const resourceResponse = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
        { params: { path: { workspaceId, resourceIdentifier } } },
    );

    if (resourceResponse.error != null) {
        const status = resourceResponse.response.status;
        if (status >= 500) {
            throw new ApiError(
                resourceResponse.error.error ?? "Internal server error",
                status,
            );
        }
        throw new ApiError(
            resourceResponse.error.error ?? "Resource not found",
            status,
        );
    }

    await sendGoEvent({
        workspaceId,
        eventType: Event.ResourceDeleted,
        timestamp: Date.now(),
        data: resourceResponse.data,
    });

    res.status(204).end();
};


const getVariablesForResource: AsyncTypedHandler<
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
    "get"
> = async (req, res) => {
    const { workspaceId, identifier } = req.params;
    const { limit, offset } = req.query;

    const resourceIdentifier = encodeURIComponent(identifier);
    const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/variables",
        {
            params: { path: { workspaceId, resourceIdentifier } },
            query: { limit, offset },
        },
    );

    if (result.error != null)
        throw new ApiError(
            result.error.error ?? "Failed to get variables for resource",
            result.response.status,
        );

    res.status(200).json(result.data);
};

const updateVariablesForResource: AsyncTypedHandler<
    "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
    "patch"
> = async (req, res) => {
    const { workspaceId, identifier } = req.params;
    const { body } = req;

    const resourceIdentifier = encodeURIComponent(identifier);
    const resourceResponse = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
        { params: { path: { workspaceId, resourceIdentifier } } },
    );

    if (resourceResponse.error != null) {
        throw new ApiError(
            resourceResponse.error.error ?? "Failed to get resource",
            resourceResponse.response.status,
        );
    }

    await sendGoEvent({
        workspaceId,
        eventType: Event.ResourceVariablesBulkUpdated,
        timestamp: Date.now(),
        data: { resourceId: resourceResponse.data.id, variables: body },
    });

    res.status(204).end();
};

const getReleaseTargetForResourceInDeployment: AsyncTypedHandler<
    "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets/deployment/{deploymentId}",
    "get"
> = async (req, res) => {
    const { workspaceId, resourceIdentifier, deploymentId } = req.params;

    const encodedResourceIdentifier = encodeURIComponent(resourceIdentifier);

    const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/release-targets/deployment/{deploymentId}",
        {
            params: {
                path: {
                    workspaceId,
                    resourceIdentifier: encodedResourceIdentifier,
                    deploymentId,
                },
            },
        },
    );

    if (result.error != null)
        throw new ApiError(
            result.error.error ??
            "Failed to get release target for resource in deployment",
            result.response.status,
        );

    res.status(200).json(result.data);
};

export const resourceRouter = Router({ mergeParams: true })
    .get("/", asyncHandler(listResources))
    .get("/identifier/:identifier", asyncHandler(getResourceByIdentifier))
    .delete(
        "/identifier/:identifier",
        asyncHandler(deleteResourceByIdentifier),
    )
    .get(
        "/identifier/:identifier/variables",
        asyncHandler(getVariablesForResource),
    )
    .patch(
        "/identifier/:identifier/variables",
        asyncHandler(updateVariablesForResource),
    )
    .get(
        "/identifier/:identifier/release-targets/deployment/:deploymentId",
        asyncHandler(getReleaseTargetForResourceInDeployment),
    );
