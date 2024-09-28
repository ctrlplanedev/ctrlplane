import { addWeeks } from "date-fns";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  isNull,
  or,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createWorkspace,
  entityRole,
  role,
  target,
  updateWorkspace,
  user,
  workspace,
  workspaceInviteToken,
} from "@ctrlplane/db/schema";
import { Permission, predefinedRoles } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { integrationsRouter } from "./workspace-integrations";
import {
  iamRouter,
  workspaceEmailDomainMatchingRouter,
} from "./workspace-security";

const membersRouter = createTRPCRouter({
  list: protectedProcedure
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
        .from(entityRole)
        .innerJoin(workspace, eq(workspace.id, entityRole.scopeId))
        .innerJoin(role, eq(entityRole.roleId, role.id))
        .innerJoin(user, eq(entityRole.entityId, user.id))
        .where(
          and(
            eq(entityRole.scopeId, input),
            eq(entityRole.scopeType, "workspace"),
          ),
        )
        .orderBy(asc(user.name), asc(user.email))
        .then((members) =>
          members.map((m) => ({
            id: m.entity_role.id,
            user: m.user,
            role: m.role,
            entityRole: m.entity_role,
            workspace: m.workspace,
          })),
        ),
    ),
});

const inviteRouter = createTRPCRouter({
  token: createTRPCRouter({
    accept: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input: inviteToken }) =>
        ctx.db.transaction(async (tx) => {
          const invite = await tx
            .select()
            .from(workspaceInviteToken)
            .where(eq(workspaceInviteToken.token, inviteToken))
            .then(takeFirst);

          return tx.insert(entityRole).values({
            roleId: invite.roleId,

            scopeType: "workspace",
            scopeId: invite.workspaceId,

            entityType: "user",
            entityId: ctx.session.user.id,
          });
        }),
      ),

    create: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.IamSetPolicy)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          roleId: z.string().uuid(),
          workspaceId: z.string().uuid(),
          token: z.string().uuid(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.db
          .insert(workspaceInviteToken)
          .values({
            ...input,
            createdBy: ctx.session.user.id,
            expiresAt: addWeeks(new Date(), 1),
          })
          .returning()
          .then(takeFirst),
      ),
  }),
});

export const workspaceRouter = createTRPCRouter({
  invite: inviteRouter,
  members: membersRouter,

  emailDomainMatching: workspaceEmailDomainMatchingRouter,
  iam: iamRouter,

  integrations: integrationsRouter,

  roles: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(role)
        .where(or(eq(role.workspaceId, input), isNull(role.workspaceId))),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateWorkspace }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(workspace)
        .set(input.data)
        .where(eq(workspace.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  create: protectedProcedure
    .input(createWorkspace)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const w = await tx
          .insert(workspace)
          .values(input)
          .returning()
          .then(takeFirst);

        await tx.insert(entityRole).values({
          roleId: predefinedRoles.admin.id,
          scopeType: "workspace",
          scopeId: w.id,
          entityType: "user",
          entityId: ctx.session.user.id,
        });

        await tx
          .update(user)
          .set({ activeWorkspaceId: w.id })
          .where(eq(user.id, ctx.session.user.id));

        return w;
      }),
    ),

  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.db
      .select()
      .from(workspace)
      .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
      .where(eq(entityRole.entityId, ctx.session.user.id))
      .then((rows) => rows.map((r) => r.workspace)),
  ),

  bySlug: protectedProcedure.input(z.string()).query(async ({ ctx, input }) =>
    ctx.db
      .select()
      .from(workspace)
      .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
      .where(
        and(
          eq(workspace.slug, input),
          eq(entityRole.entityId, ctx.session.user.id),
        ),
      )
      .then(takeFirstOrNull)
      .then((workspace) => workspace?.workspace ?? null),
  ),

  byId: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspace)
        .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
        .where(
          and(
            eq(workspace.id, input),
            eq(entityRole.entityId, ctx.session.user.id),
          ),
        )
        .then(takeFirstOrNull)
        .then((w) => w?.workspace ?? null),
    ),

  targetKinds: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const kinds = await ctx.db
        .selectDistinct({ kind: target.kind })
        .from(target)
        .where(eq(target.workspaceId, input))
        .orderBy(asc(target.kind));

      return kinds.map((row) => row.kind);
    }),
});
