import type { PushEvent, WorkflowRunEvent } from "@octokit/webhooks-types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { GithubEvent } from "@ctrlplane/validators/github";

import { handleCommitWebhookEvent } from "./commit/handler";
import { handleWorkflowWebhookEvent } from "./workflow/handler";

export const POST = async (req: NextRequest) => {
  try {
    const event = req.headers.get("x-github-event")?.toString();
    const data = await req.json();

    if (event === GithubEvent.Push)
      await handleCommitWebhookEvent(data as PushEvent);
    if (event === GithubEvent.WorkflowRun)
      await handleWorkflowWebhookEvent(data as WorkflowRunEvent);
    return new NextResponse("OK");
  } catch (e) {
    return new NextResponse((e as any).message, { status: 500 });
  }
};
