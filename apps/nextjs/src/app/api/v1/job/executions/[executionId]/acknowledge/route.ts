import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { databaseJobQueue } from "@ctrlplane/job-dispatch/queue";

export const POST = async (
  _: NextRequest,
  { params }: { params: { executionId: string } },
) => {
  await databaseJobQueue.acknowledge(params.executionId);
  return NextResponse.json({ sucess: true });
};
