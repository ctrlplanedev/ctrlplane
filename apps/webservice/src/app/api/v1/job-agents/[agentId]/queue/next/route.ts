import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent } from "@ctrlplane/db/schema";
import { databaseJobQueue } from "@ctrlplane/job-dispatch/queue";

export const GET = async (
  _: NextRequest,
  { params }: { params: { workspace: string; agentId: string } },
) => {
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
