import { NextResponse } from "next/server";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { authn } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  resourceIdentifier: z.string(),
});

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .handle<{ body: z.infer<typeof bodySchema> }>(async (ctx) => {
    const { body, db } = ctx;
    const job = await db.query.job.findFirst({
      where: eq(SCHEMA.job.id, body.jobId),
      with: { releaseTrigger: { with: { resource: true } } },
    });

    const releaseTrigger = job?.releaseTrigger[0];
    if (job == null || releaseTrigger == null)
      return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const jobId = job.id;
    const resourceIdentifier = body.resourceIdentifier;
    return db
      .insert(SCHEMA.jobResourceRelationship)
      .values({ jobId, resourceIdentifier })
      .returning()
      .then(takeFirst)
      .then((r) => NextResponse.json(r))
      .catch((e: Error) =>
        e.message.includes("duplicate key value")
          ? NextResponse.json(
              { error: "Relationship already exists" },
              { status: 409 },
            )
          : NextResponse.json({ error: e.message }, { status: 500 }),
      );
  });
