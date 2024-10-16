import { NextResponse } from "next/server";

import { sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";

export const GET = async () => {
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ status: "error", error }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
};
