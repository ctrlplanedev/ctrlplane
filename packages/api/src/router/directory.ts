import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, like, ne, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const directoryRouter = createTRPCRouter({
  listRoots: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentList)
          .on({ type: "system", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const directoryPaths = await ctx.db
        .selectDistinctOn([SCHEMA.environment.directory])
        .from(SCHEMA.environment)
        .where(
          and(
            eq(SCHEMA.environment.systemId, input),
            ne(SCHEMA.environment.directory, ""),
          ),
        )
        .then((rows) => rows.map((r) => r.directory));

      const rootPaths = Array.from(
        new Set(
          directoryPaths
            .map((path) => {
              const normalizedPath = path.startsWith("/") ? path : `/${path}`;
              return normalizedPath.split("/")[1];
            })
            .filter(isPresent),
        ),
      );

      const rootDirsWithEnvironments = await Promise.all(
        rootPaths.map(async (root) => {
          const environments = await ctx.db
            .select()
            .from(SCHEMA.environment)
            .where(
              and(
                eq(SCHEMA.environment.systemId, input),
                or(
                  eq(SCHEMA.environment.directory, root),
                  eq(SCHEMA.environment.directory, `/${root}`),
                  like(SCHEMA.environment.directory, `${root}/%`),
                  like(SCHEMA.environment.directory, `%/${root}/%`),
                ),
              ),
            );

          return {
            path: root,
            environments,
          };
        }),
      );

      const rootEnvironments = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(
          and(
            eq(SCHEMA.environment.systemId, input),
            eq(SCHEMA.environment.directory, ""),
          ),
        );

      return { directories: rootDirsWithEnvironments, rootEnvironments };
    }),
});
