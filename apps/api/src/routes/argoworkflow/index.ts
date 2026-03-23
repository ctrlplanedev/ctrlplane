import type { Request, Response } from "express";
import { env } from "@/config.js";
import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { handleArgoWorkflow } from "./run_workflow.js";

export const createArgoWorkflowRouter = (): Router =>
  Router().post("/webhook", asyncHandler(handleWebhookRequest));

const verifyRequest = async (req: Request): Promise<boolean> => {
  const authHeader = req.headers["authorization"]?.toString();
  if (authHeader == null) return false;
  const secret = env.ARGO_WORKFLOW_WEBHOOK_SECRET;
  return authHeader === secret;
};

const handleWebhookRequest = async (req: Request, res: Response) => {
  const isVerified = await verifyRequest(req);
  if (!isVerified) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = req.body;
  console.log("handleArgoWorkflow payload:", JSON.stringify(payload, null, 2));
  await handleArgoWorkflow(payload);
  res.status(200).send();
};
