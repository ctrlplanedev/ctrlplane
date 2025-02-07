import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent } from "@ctrlplane/db/schema";
import { databaseJobQueue } from "@ctrlplane/job-dispatch/queue";

import { getUser } from "~/app/api/v1/auth";

export const GET = async (
  req: NextRequest,
  props: { params: Promise<{ workspace: string; agentId: string }> },
) => {
  const params = await props.params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jd = await db
    .select()
    .from(jobAgent)
    .where(eq(jobAgent.id, params.agentId))
    .then(takeFirstOrNull);

  return jd == null
    ? NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    : NextResponse.json({
        jobs: await databaseJobQueue.next(params.agentId),
      });
};
