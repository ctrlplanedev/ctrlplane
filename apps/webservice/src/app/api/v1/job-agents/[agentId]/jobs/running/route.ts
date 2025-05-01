import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { getUser } from "~/app/api/v1/auth";

export const GET = async (
  req: NextRequest,
  props: { params: Promise<{ agentId: string }> },
) => {
  const params = await props.params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await db
    .select()
    .from(SCHEMA.job)
    .where(
      and(
        eq(SCHEMA.job.jobAgentId, params.agentId),
        notInArray(SCHEMA.job.status, [
          JobStatus.Failure,
          JobStatus.Cancelled,
          JobStatus.Skipped,
          JobStatus.Successful,
          JobStatus.InvalidJobAgent,
        ]),
      ),
    );

  return NextResponse.json({ jobs });
};
