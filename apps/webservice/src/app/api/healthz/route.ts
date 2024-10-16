import { NextResponse } from "next/server";
import IORedis from "ioredis";

import { sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";

import { env } from "~/env";

export const GET = async () => {
  try {
    await new IORedis(env.REDIS_URL).ping();
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    return NextResponse.json({ status: "error", error }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
};
