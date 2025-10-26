import type { AsyncTypedHandler } from "@/types/api.js";
import { wsEngine } from "@/engine.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

const listDeployments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const response = await wsEngine.GET(
    "/v1/workspaces/{workspaceId}/deployments",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.json(response.data);
};

export const deploymentsRouter = Router({ mergeParams: true }).get(
  "/",
  asyncHandler(listDeployments),
);
