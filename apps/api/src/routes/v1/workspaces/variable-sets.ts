import type { AsyncTypedHandler } from "@/types/api.js";
import { asyncHandler, BadRequestError, NotFoundError } from "@/types/api.js";
import { Router } from "express";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueAllReleaseTargetsDesiredVersion } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

const listVariableSets: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/variable-sets",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  const total = await db
    .select({ total: count() })
    .from(schema.variableSet)
    .where(eq(schema.variableSet.workspaceId, workspaceId))
    .then(takeFirst)
    .then(({ total }) => total);

  const sets = await db
    .select()
    .from(schema.variableSet)
    .where(eq(schema.variableSet.workspaceId, workspaceId))
    .orderBy(desc(schema.variableSet.priority), schema.variableSet.name)
    .limit(limit)
    .offset(offset);

  const setIds = sets.map((s) => s.id);
  const allVariables =
    setIds.length > 0
      ? await db
          .select()
          .from(schema.variableSetVariable)
          .where(inArray(schema.variableSetVariable.variableSetId, setIds))
      : [];

  const items = sets.map((s) => ({
    ...s,
    variables: allVariables.filter((v) => v.variableSetId === s.id),
  }));

  res.status(200).json({ items, total, limit, offset });
};

const createVariableSet: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/variable-sets",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { variables = [], ...setData } = req.body;

  const keys = variables.map((v) => v.key);
  const duplicateKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicateKeys.length > 0)
    throw new BadRequestError(
      `Duplicate variable keys: ${[...new Set(duplicateKeys)].join(", ")}`,
    );

  const created = await db.transaction(async (tx) => {
    const vs = await tx
      .insert(schema.variableSet)
      .values({ ...setData, workspaceId })
      .returning()
      .then(takeFirst);

    if (variables.length > 0)
      await tx.insert(schema.variableSetVariable).values(
        variables.map((v) => ({
          variableSetId: vs.id,
          key: v.key,
          value: v.value,
        })),
      );

    return vs;
  });

  enqueueAllReleaseTargetsDesiredVersion(db, workspaceId);

  res.status(201).json(created);
};

const getVariableSet: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/variable-sets/{variableSetId}",
  "get"
> = async (req, res) => {
  const { variableSetId, workspaceId } = req.params;
  const vs = await db
    .select()
    .from(schema.variableSet)
    .where(
      and(
        eq(schema.variableSet.id, variableSetId),
        eq(schema.variableSet.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (vs == null) throw new NotFoundError("Variable set not found");

  const variables = await db
    .select()
    .from(schema.variableSetVariable)
    .where(eq(schema.variableSetVariable.variableSetId, variableSetId));

  res.json({ ...vs, variables });
};

const updateVariableSet: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/variable-sets/{variableSetId}",
  "put"
> = async (req, res) => {
  const { variableSetId, workspaceId } = req.params;
  const { variables, ...setData } = req.body;

  if (variables != null) {
    const keys = variables.map((v) => v.key);
    const duplicateKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicateKeys.length > 0)
      throw new BadRequestError(
        `Duplicate variable keys: ${[...new Set(duplicateKeys)].join(", ")}`,
      );
  }

  const updated = await db.transaction(async (tx) => {
    const vs = await tx
      .update(schema.variableSet)
      .set(setData)
      .where(
        and(
          eq(schema.variableSet.id, variableSetId),
          eq(schema.variableSet.workspaceId, workspaceId),
        ),
      )
      .returning()
      .then(takeFirstOrNull);

    if (vs == null) return null;

    if (variables != null) {
      await tx
        .delete(schema.variableSetVariable)
        .where(eq(schema.variableSetVariable.variableSetId, variableSetId));

      if (variables.length > 0) {
        await tx.insert(schema.variableSetVariable).values(
          variables.map((v) => ({
            variableSetId: vs.id,
            key: v.key,
            value: v.value,
          })),
        );
      }
    }

    enqueueAllReleaseTargetsDesiredVersion(tx, workspaceId);

    return vs;
  });

  if (updated == null) throw new NotFoundError("Variable set not found");
  res.status(202).json(updated);
};

const deleteVariableSet: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/variable-sets/{variableSetId}",
  "delete"
> = async (req, res) => {
  const { variableSetId, workspaceId } = req.params;
  const deleted = await db
    .delete(schema.variableSet)
    .where(
      and(
        eq(schema.variableSet.id, variableSetId),
        eq(schema.variableSet.workspaceId, workspaceId),
      ),
    )
    .returning()
    .then(takeFirstOrNull);

  if (deleted == null) throw new NotFoundError("Variable set not found");

  enqueueAllReleaseTargetsDesiredVersion(db, workspaceId);

  res.status(202).json(deleted);
};

export const variableSetsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listVariableSets))
  .post("/", asyncHandler(createVariableSet))
  .get("/:variableSetId", asyncHandler(getVariableSet))
  .put("/:variableSetId", asyncHandler(updateVariableSet))
  .delete("/:variableSetId", asyncHandler(deleteVariableSet));
