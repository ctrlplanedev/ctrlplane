import { NextResponse } from "next/server";

import { sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { checkHealth } from "@ctrlplane/job-dispatch";

export const GET = async () => {
  try {
    await checkHealth();
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ status: "error", error }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
};
