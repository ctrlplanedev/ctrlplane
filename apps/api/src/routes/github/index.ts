import type { WorkflowRunEvent } from "@octokit/webhooks-types";
import type { Request, Response } from "express";
import { env } from "@/config.js";
import { Webhooks } from "@octokit/webhooks";
import express, { Router } from "express";

import { logger } from "@ctrlplane/logger";

import { handleWorkflowRunEvent } from "./workflow_run.js";

export const createGithubRouter = (): Router =>
  Router().post(
    "/webhook",
    express.raw({ type: "application/json" }),
    handleWebhookRequest,
  );

const getGithubWebhooksObject = (): Webhooks => {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (secret == null) throw new Error("GITHUB_WEBHOOK_SECRET is not set");
  return new Webhooks({ secret });
};

const verifyRequest = async (
  body: Buffer,
  signature: string,
): Promise<boolean> => {
  const webhooks = getGithubWebhooksObject();
  return webhooks.verify(body.toString("utf8"), signature);
};

const handleWebhookRequest = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-hub-signature-256"]?.toString();
    if (
      signature == null ||
      !(await verifyRequest(req.body as Buffer, signature))
    ) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const payload = JSON.parse((req.body as Buffer).toString("utf8"));
    const eventType = req.headers["x-github-event"]?.toString();
    if (eventType === "workflow_run")
      await handleWorkflowRunEvent(payload as WorkflowRunEvent);

    res.status(200).json({ message: "OK" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    res.status(500).json({ message });
  }
};
