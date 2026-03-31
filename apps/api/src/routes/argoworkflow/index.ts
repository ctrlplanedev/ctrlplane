import type { Request, Response } from "express";
import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { handleArgoWorkflow } from "./workflow.js";

export const createArgoWorkflowRouter = (): Router =>
  Router().post("/:id/webhook", asyncHandler(handleWebhookRequest));

const getJobAgent = async (id: string) => {
  return db.query.jobAgent.findFirst({
    where: eq(schema.jobAgent.id, id),
  });
};

const handleWebhookRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (id == null) {
    res.status(400).json({ message: "Missing job agent id" });
    return;
  }

  const agent = await getJobAgent(id);
  if (agent == null) {
    res.status(404).json({ message: "Job agent not found" });
    return;
  }

  const config = agent.config as Record<string, unknown>;
  const webhookSecret =
    typeof config.webhookSecret === "string" ? config.webhookSecret : null;
  if (webhookSecret == null) {
    res
      .status(500)
      .json({ message: "Job agent has no webhookSecret configured" });
    return;
  }

  const authHeader = req.headers.authorization?.toString();
  if (authHeader == null || authHeader !== webhookSecret) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = req.body;
  await handleArgoWorkflow(payload);
  res.status(200).send();
};
