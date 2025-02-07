import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { databaseJobQueue } from "@ctrlplane/job-dispatch/queue";

import { getUser } from "~/app/api/v1/auth";

export const POST = async (
  req: NextRequest,
  props: { params: Promise<{ jobId: string }> },
) => {
  const params = await props.params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await databaseJobQueue.acknowledge(params.jobId);
  return NextResponse.json({ sucess: true });
};
