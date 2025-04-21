import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.DeploymentGet).on({
        type: "deployment",
        id: params.deploymentId ?? "",
      }),
    ),
  )
  .handle<unknown, { params: Promise<{ deploymentId: string }> }>(
    async (ctx, { params }) => {
      const { deploymentId } = await params;

      const deployment = await ctx.db.query.deployment.findFirst({
        where: eq(schema.resource.id, deploymentId),
        with: { system: true },
      });

      if (deployment == null)
        return NextResponse.json(
          { error: "Deployment not found" },
          { status: 404 },
        );

      if (deployment.resourceSelector == null)
        return NextResponse.json(
          {
            error:
              "Deployment has no resource selector. All resources in workspace apply.",
          },
          { status: 400 },
        );

      const resources = await ctx.db
        .select()
        .from(schema.resource)
        .innerJoin(
          schema.computedDeploymentResource,
          eq(schema.resource.id, schema.computedDeploymentResource.resourceId),
        )
        .where(eq(schema.computedDeploymentResource.deploymentId, deploymentId))
        .limit(1_000)
        .then((res) => res.map((r) => ({ ...r.resource })));

      return NextResponse.json({
        resources,
        count: resources.length,
      });
    },
  );
