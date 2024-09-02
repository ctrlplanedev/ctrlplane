import { addWeeks } from "date-fns";
import { z } from "zod";

import { and, eq, gte, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
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
          .where(
            and(
              eq(workspaceInviteLink.workspaceMemberId, input),
              gte(workspaceInviteLink.expiresAt, new Date()),
            ),
          )
          .then(takeFirstOrNull);
      }),
    create: protectedProcedure
      .meta({
        access: ({ ctx, input }) =>
          ctx.accessQuery().workspace.id(input.workspaceId),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          workspaceMemberId: z.string().uuid(),
          token: z.string().uuid(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.db
          .insert(workspaceInviteLink)
          .values({
            workspaceMemberId: input.workspaceMemberId,
            expiresAt: addWeeks(new Date(), 1),
            token: input.token,
          })
          .returning()
          .then(takeFirst),
      ),
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
