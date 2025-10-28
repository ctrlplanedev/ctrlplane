import { z } from "zod";

import { scopeHandlers } from "@ctrlplane/auth/utils";
import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createEntityRole,
  createWorkspaceEmailDomainMatching,
  entityRole,
  workspaceEmailDomainMatching,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { env } from "../config";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const workspaceEmailDomainMatchingRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.WorkspaceListMembers)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspaceEmailDomainMatching)
        .where(eq(workspaceEmailDomainMatching.workspaceId, input)),
    ),

  verify: publicProcedure
    .input(z.object({ code: z.string().min(10), email: z.string().email() }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(workspaceEmailDomainMatching)
        .set({ verified: true })
        .where(
          and(
            eq(workspaceEmailDomainMatching.verificationCode, input.code),
            eq(workspaceEmailDomainMatching.verificationEmail, input.email),
          ),
        ),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.WorkspaceUpdate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createWorkspaceEmailDomainMatching)
    .mutation(async ({ ctx, input }) => {
      const randomString = [...Array(10)]
        .map(() => Math.random().toString(36)[2])
        .join("");
      const email = ctx.session.user.email;

      const domain = email.split("@")[1];
      if (domain == null) return;

      return ctx.db
        .insert(workspaceEmailDomainMatching)
        .values({
          ...input,
          domain,
          verified: !env.REQUIRE_DOMAIN_MATCHING_VERIFICATION,
          verificationCode: randomString,
          verificationEmail: email,
        })
        .returning()
        .then(takeFirst);
    }),

  remove: protectedProcedure
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const workspaceRecord = await ctx.db
          .select()
          .from(workspaceEmailDomainMatching)
          .where(eq(workspaceEmailDomainMatching.id, input))
          .then(takeFirstOrNull);
        if (!workspaceRecord) throw new Error("Workspace not found");
        return canUser
          .perform(Permission.WorkspaceUpdate)
          .on({ type: "workspace", id: workspaceRecord.workspaceId });
      },
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(workspaceEmailDomainMatching)
        .where(eq(workspaceEmailDomainMatching.id, input)),
    ),
});

export const iamRouter = createTRPCRouter({
  assign: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        const scopes = await scopeHandlers[
          input.scopeType as keyof typeof scopeHandlers
        ](input.scopeId);
        const workspaceScope = scopes.find(
          (scope) => scope.type === "workspace",
        );
        if (!workspaceScope) throw new Error("Workspace scope not found");
        return canUser
          .perform(Permission.IamSetPolicy)
          .on({ type: "workspace", id: workspaceScope.id });
      },
    })
    .input(createEntityRole)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(entityRole).values(input).returning(),
    ),
  remove: protectedProcedure
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const entityRoleRecord = await ctx.db
          .select()
          .from(entityRole)
          .where(eq(entityRole.id, input))
          .then(takeFirstOrNull);

        if (!entityRoleRecord) throw new Error("Entity role not found");

        const scopes = await scopeHandlers[entityRoleRecord.scopeType](
          entityRoleRecord.scopeId,
        );
        const workspaceScope = scopes.find(
          (scope) => scope.type === "workspace",
        );
        if (!workspaceScope) throw new Error("Workspace scope not found");

        return canUser
          .perform(Permission.IamSetPolicy)
          .on({ type: "workspace", id: workspaceScope.id });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.delete(entityRole).where(eq(entityRole.id, input)).returning(),
    ),

  set: protectedProcedure
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const entityRoleRecord = await ctx.db
          .select()
          .from(entityRole)
          .where(eq(entityRole.id, input.entityRoleId))
          .then(takeFirstOrNull);

        if (!entityRoleRecord) throw new Error("Entity role not found");

        const scopes = await scopeHandlers[entityRoleRecord.scopeType](
          entityRoleRecord.scopeId,
        );
        const workspaceScope = scopes.find(
          (scope) => scope.type === "workspace",
        );
        if (!workspaceScope) throw new Error("Workspace scope not found");

        return canUser
          .perform(Permission.IamSetPolicy)
          .on({ type: "workspace", id: workspaceScope.id });
      },
    })
    .input(
      z.object({
        entityRoleId: z.string().uuid(),
        newRoleId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(entityRole)
        .set({ roleId: input.newRoleId })
        .where(eq(entityRole.id, input.entityRoleId))
        .returning()
        .then(takeFirst),
    ),
});
