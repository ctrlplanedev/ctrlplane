import type { Request, Response } from "express";

import { env } from "@/config.js";

const WORKSPACE_ENGINE_TIMEOUT_MS = 2000;

const fetchWorkspaceEngineVersion = async (): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WORKSPACE_ENGINE_TIMEOUT_MS,
  );
  try {
    const baseUrl = env.WORKSPACE_ENGINE_URL ?? "http://localhost:8081";
    const response = await fetch(`${baseUrl}/healthz`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const versionHandler = async (
  _: Request,
  res: Response,
): Promise<void> => {
  const api = env.CTRLPLANE_VERSION;
  const workspaceEngine = await fetchWorkspaceEngineVersion();
  res.status(200).json({ api, workspaceEngine });
};
