import type { WorkflowRunEvent } from "@octokit/webhooks-types";
import type { Request, Response } from "express";
import { env } from "@/config.js";
import { asyncHandler } from "@/types/api.js";
import { Webhooks } from "@octokit/webhooks";
import { Router } from "express";

import { logger } from "@ctrlplane/logger";

import { handleWorkflowRunEvent } from "./workflow_run.js";

export const createGithubRouter = (): Router =>
  Router().post("/webhooks", asyncHandler(handleWebhookRequest));

const getGithubWebhooksObject = (): Webhooks => {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (secret == null) throw new Error("GITHUB_WEBHOOK_SECRET is not set");
  return new Webhooks({ secret });
};

const verifyRequest = async (req: Request): Promise<boolean> => {
  const webhooks = getGithubWebhooksObject();
  const signature = req.headers["x-hub-signature-256"]?.toString();
  if (signature == null) return false;

  const { body } = req;
  const json = JSON.stringify(body);
  return webhooks.verify(json, signature);
};

const handleWebhookRequest = async (req: Request, res: Response) => {
  try {
    const isVerified = await verifyRequest(req);
    if (!isVerified) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const eventType = req.headers["x-github-event"]?.toString();
    if (eventType === "workflow_run")
      await handleWorkflowRunEvent(req.body as WorkflowRunEvent);

    res.status(200).json({ message: "OK" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    res.status(500).json({ message });
  }
};
