import type { WorkflowRunEvent } from "@octokit/webhooks-types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Webhooks } from "@octokit/webhooks";

import { GithubEvent } from "@ctrlplane/validators/github";

import { env } from "~/env";
import { handleWorkflowWebhookEvent } from "./workflow/handler";

export const POST = async (req: NextRequest) => {
  try {
    const secret = env.GITHUB_WEBHOOK_SECRET;
    if (secret == null) throw new Error("GITHUB_WEBHOOK_SECRET is not set");
    const webhooks = new Webhooks({ secret });

    const signature = req.headers.get("x-hub-signature-256")?.toString();
    if (signature == null)
      return new NextResponse("No signature", { status: 401 });
    const data = await req.json();

    const json = JSON.stringify(data);
    const isVerified = await webhooks.verify(json, signature);
    if (!isVerified) return new NextResponse("Not verified", { status: 401 });

    const event = req.headers.get("x-github-event")?.toString();
    if (event === GithubEvent.WorkflowRun)
      await handleWorkflowWebhookEvent(data as WorkflowRunEvent);
    return new NextResponse("OK");
  } catch (e) {
    return new NextResponse((e as any).message, { status: 500 });
  }
};
