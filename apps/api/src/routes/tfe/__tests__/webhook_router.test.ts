import crypto from "node:crypto";
import type { Request, Response } from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock config before importing the module under test
vi.mock("@/config.js", () => ({
  env: { TFE_WEBHOOK_SECRET: "test-secret-123" },
}));

vi.mock("@ctrlplane/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const mockHandleRunNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("../run_notification.js", () => ({
  handleRunNotification: (...args: unknown[]) =>
    mockHandleRunNotification(...args),
}));

import { createTfeRouter } from "../index.js";

function signPayload(body: object, secret: string): string {
  const json = JSON.stringify(body);
  return crypto.createHmac("sha512", secret).update(json).digest("hex");
}

function makeMockRes() {
  const res = { statusCode: 200, _json: null as unknown };
  return Object.assign(res, {
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (data: unknown) => {
      res._json = data;
      return res;
    },
  }) as typeof res & Response;
}

function getWebhookHandler() {
  const router = createTfeRouter();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === "/webhook" && l.route?.methods?.post,
  );
  if (!layer) throw new Error("POST /webhook route not found on router");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const handlers = layer.route.stack.filter(
    (s: any) => s.method === "post",
  );
  return handlers[handlers.length - 1].handle as (
    req: Request,
    res: Response,
  ) => Promise<void>;
}

describe("TFE webhook router", () => {
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeEach(() => {
    handler = getWebhookHandler();
    vi.clearAllMocks();
  });

  const payload = {
    payload_version: 1,
    notification_configuration_id: "nc-test",
    run_url: "https://app.terraform.io/runs/run-abc",
    run_id: "run-abc",
    run_message: "test",
    run_created_at: "2024-01-01T00:00:00Z",
    run_created_by: "user",
    workspace_id: "ws-test",
    workspace_name: "test-ws",
    organization_name: "org",
    notifications: [
      {
        message: "Applied",
        trigger: "run:completed",
        run_status: "applied",
        run_updated_at: "2024-01-01T00:01:00Z",
        run_updated_by: "user",
      },
    ],
  };

  it("returns 200 and calls handler with valid signature", async () => {
    const signature = signPayload(payload, "test-secret-123");
    const req = {
      headers: { "x-tfe-notification-signature": signature },
      body: payload,
    } as unknown as Request;
    const res = makeMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect((res as any)._json).toEqual({ message: "OK" });
    expect(mockHandleRunNotification).toHaveBeenCalledOnce();
    expect(mockHandleRunNotification).toHaveBeenCalledWith(payload);
  });

  it("returns 401 with missing signature header", async () => {
    const req = {
      headers: {},
      body: payload,
    } as unknown as Request;
    const res = makeMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect((res as any)._json).toEqual({ message: "Unauthorized" });
    expect(mockHandleRunNotification).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong signature", async () => {
    const req = {
      headers: {
        "x-tfe-notification-signature": "deadbeef".repeat(16),
      },
      body: payload,
    } as unknown as Request;
    const res = makeMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(mockHandleRunNotification).not.toHaveBeenCalled();
  });

  it("returns 200 without calling handler when notifications is empty", async () => {
    const emptyPayload = { ...payload, notifications: [] };
    const signature = signPayload(emptyPayload, "test-secret-123");
    const req = {
      headers: { "x-tfe-notification-signature": signature },
      body: emptyPayload,
    } as unknown as Request;
    const res = makeMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockHandleRunNotification).not.toHaveBeenCalled();
  });

  it("returns 500 when handler throws", async () => {
    mockHandleRunNotification.mockRejectedValueOnce(
      new Error("db connection lost"),
    );
    const signature = signPayload(payload, "test-secret-123");
    const req = {
      headers: { "x-tfe-notification-signature": signature },
      body: payload,
    } as unknown as Request;
    const res = makeMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect((res as any)._json).toEqual({ message: "db connection lost" });
  });
});
