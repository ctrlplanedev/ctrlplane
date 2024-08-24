import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent } from "@ctrlplane/db/schema";
import { databaseJobQueue } from "@ctrlplane/job-dispatch/queue";

export const POST = async (
  req: NextRequest,
  { params }: { params: { agentId: string } },
) => {
  const jd = await db
    .select()
    .from(jobAgent)
    .where(eq(jobAgent.id, params.agentId))
    .then(takeFirstOrNull);

  if (jd == null)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return NextResponse.json({
    jobExecution: databaseJobQueue.acknowledge(jd.id),
  });
};
