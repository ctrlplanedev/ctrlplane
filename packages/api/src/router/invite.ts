import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  workspace,
  workspaceInviteLink,
  workspaceMember,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const workspaceRouter = createTRPCRouter({
  link: createTRPCRouter({
    byWorkspaceMemberId: protectedProcedure
      .input(z.string())
      .query(async ({ ctx, input }) => {
        return ctx.db
          .select()
          .from(workspaceInviteLink)
          .where(eq(workspaceInviteLink.workspaceMemberId, input))
          .then(takeFirstOrNull);
      }),
    create: protectedProcedure
      .meta({
        access: ({ ctx, input }) => ctx.accessQuery().workspace.id(input),
      })
      .input(z.string())
      .mutation(async ({ ctx, input }) => {
        return ctx.db
          .insert(workspaceInviteLink)
          .values({
            workspaceMemberId: input,
          })
          .returning()
          .then(takeFirst);
      }),
  }),

  fromInviteToken: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspaceInviteLink)
        .innerJoin(
          workspaceMember,
          eq(workspaceInviteLink.workspaceMemberId, workspaceMember.id),
        )
        .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
        .where(eq(workspaceInviteLink.token, input))
        .then((data) => data.map((d) => d.workspace))
        .then(takeFirstOrNull),
    ),
});

export const invitesRouter = createTRPCRouter({
  workspace: workspaceRouter,
});
