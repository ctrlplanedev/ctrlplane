import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent } from "@ctrlplane/db/schema";
import { databaseJobQueue } from "@ctrlplane/job-dispatch/queue";

import { getUser } from "~/app/api/v1/auth";

export const POST = async (req: NextRequest, props: { params: Promise<{ agentId: string }> }) => {
  const params = await props.params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jd = await db
    .select()
    .from(jobAgent)
    .where(eq(jobAgent.id, params.agentId))
    .then(takeFirstOrNull);

  if (jd == null)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return NextResponse.json({
    job: databaseJobQueue.acknowledge(jd.id),
  });
};
