import type { SQL, Tx } from "@ctrlplane/db";
import type { EqualCondition } from "@ctrlplane/validators/targets";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  inArray,
  like,
  or,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createTarget,
  target,
  targetLabel,
  targetMatchsLabel,
  targetProvider,
  updateTarget,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { targetLabelGroupRouter } from "./target-label-group";
import { targetProviderRouter } from "./target-provider";

const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      target: target,
      targetProvider: targetProvider,
      workspace: workspace,
      targetLabels: sql<
        Record<string, string>
      >`jsonb_object_agg(target_label.label,
       target_label.value)`.as("target_labels"),
    })
    .from(target)
    .leftJoin(targetProvider, eq(target.providerId, targetProvider.id))
    .innerJoin(workspace, eq(target.workspaceId, workspace.id))
    .innerJoin(targetLabel, eq(targetLabel.targetId, target.id))
    .where(and(...checks))
    .groupBy(target.id, targetProvider.id, workspace.id)
    .orderBy(asc(target.kind), asc(target.name));

export const targetRouter = createTRPCRouter({
  labelGroup: targetLabelGroupRouter,
  provider: targetProviderRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetGet).on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const labels = await ctx.db
        .select()
        .from(targetLabel)
        .where(eq(targetLabel.targetId, input))
        .then((lbs) =>
          Object.fromEntries(lbs.map((lb) => [lb.label, lb.value])),
        );
      return ctx.db
        .select()
        .from(target)
        .leftJoin(targetProvider, eq(target.providerId, targetProvider.id))
        .where(eq(target.id, input))
        .then(takeFirstOrNull)
        .then((a) =>
          a == null
            ? null
            : { ...a.target, labels, provider: a.target_provider },
        );
    }),

  byWorkspaceId: createTRPCRouter({
    list: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.TargetList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          filters: z
            .array(
              z.object({
                key: z.enum(["name", "kind", "labels"]),
                value: z.any(),
              }),
            )
            .optional(),
          limit: z.number().default(500),
          offset: z.number().default(0),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck = eq(workspace.id, input.workspaceId);

        const nameFilters = (input.filters ?? [])
          .filter((f) => f.key === "name")
          .map((f) => like(target.name, `%${f.value}%`));
        const kindFilters = (input.filters ?? [])
          .filter((f) => f.key === "kind")
          .map((f) => eq(target.kind, f.value));
        const labelFilters: EqualCondition[][] = (input.filters ?? [])
          .filter((f) => f.key === "labels")
          .map((t) => Object.entries(t.value))
          .map((t) =>
            t.map(([label, value]) => ({ label, value: value as string })),
          );

        const targetConditions = targetMatchsLabel(ctx.db, {
          operator: "or",
          conditions: labelFilters.map((labelGroup) => ({
            operator: "and",
            conditions: labelGroup.map(({ label, value }) => ({
              label,
              value,
              operator: "equals",
            })),
          })),
        });

        const checks = [
          workspaceIdCheck,
          or(...nameFilters),
          or(...kindFilters),
          targetConditions,
        ].filter(isPresent);

        const items = targetQuery(ctx.db, checks)
          .limit(input.limit)
          .offset(input.offset)
          .then((t) =>
            t.map((a) => ({
              ...a.target,
              provider: a.targetProvider,
              labels: a.targetLabels,
            })),
          );
        const total = targetQuery(ctx.db, checks).then((t) => t.length);

        return Promise.all([items, total]).then(([items, total]) => ({
          items,
          total,
        }));
      }),

    kinds: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.TargetList)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .selectDistinct({ kind: target.kind })
          .from(target)
          .innerJoin(workspace, eq(target.workspaceId, workspace.id))
          .where(eq(workspace.id, input))
          .then((r) => r.map((row) => row.kind)),
      ),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createTarget)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(target).values(input).returning().then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateTarget }))
    .mutation(({ ctx, input: { id, data } }) =>
      ctx.db
        .update(target)
        .set(data)
        .where(eq(target.id, id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetDelete).on(
          ...(input as string[]).map((t) => ({
            type: "target" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(target).where(inArray(target.id, input)).returning(),
    ),

  labelKeys: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: targetLabel.label })
        .from(target)
        .innerJoin(targetLabel, eq(targetLabel.targetId, target.id))
        .where(eq(target.workspaceId, input))
        .then((r) => r.map((row) => row.key)),
    ),

  lock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(target)
        .set({ lockedAt: new Date() })
        .where(eq(target.id, input))
        .returning()
        .then(takeFirst),
    ),

  unlock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(target)
        .set({ lockedAt: null })
        .where(eq(target.id, input))
        .returning()
        .then(takeFirst),
    ),
});
