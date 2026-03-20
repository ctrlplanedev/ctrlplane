import type { Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "@/config.js";
import { Router } from "express";

import { logger } from "@ctrlplane/logger";

import { handleRunNotification } from "./run_notification.js";

export const createTfeRouter = (): Router =>
  Router().post("/webhook", handleWebhookRequest);

const verifySignature = (req: Request): boolean => {
  const secret = env.TFE_WEBHOOK_SECRET;
  if (secret == null) return false;

  const signature = req.headers["x-tfe-notification-signature"]?.toString();
  if (signature == null) return false;

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
};

const handleWebhookRequest = async (req: Request, res: Response) => {
  try {
    if (!verifySignature(req)) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const payload = req.body;
    if (payload.notifications != null && payload.notifications.length > 0)
      await handleRunNotification(payload);

    res.status(200).json({ message: "OK" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(message);
    res.status(500).json({ message });
  }
};
