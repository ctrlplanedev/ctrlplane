import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { publicProcedure, router } from "../trpc.js";

export const userRouter = router({
  session: publicProcedure.query(async ({ ctx }) => {
    if (ctx.session == null) return null;
    const user = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, ctx.session.user.id))
      .then(takeFirst);

    const workspaces = await ctx.db
      .select()
      .from(schema.workspace)
      .innerJoin(
        schema.entityRole,
        eq(schema.workspace.id, schema.entityRole.scopeId),
      )
      .where(eq(schema.entityRole.entityId, user.id))
      .then((rows) => rows.map((r) => r.workspace));

    return { ...user, workspaces };
  }),
});
