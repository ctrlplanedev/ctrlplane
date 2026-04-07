import crypto from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  entityRole,
  role,
  rolePermission,
  user,
  userApiKey,
  workspace,
} from "@ctrlplane/db/schema";

const generateApiKey = () => {
  const prefix = crypto.randomBytes(8).toString("hex");
  const secret = crypto.randomBytes(32).toString("hex");
  const apiKey = `${prefix}.${secret}`;
  const keyHash = crypto.createHash("sha256").update(secret).digest("hex");
  return { apiKey, prefix, keyHash };
};

async function seed() {
  const workspaceId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const workspaceName = `e2e-test-${crypto.randomBytes(4).toString("hex")}`;

  await db.insert(user).values({
    id: userId,
    name: "E2E Test User",
    email: `e2e-${crypto.randomBytes(4).toString("hex")}@test.local`,
    emailVerified: true,
    activeWorkspaceId: null,
  });

  await db.insert(workspace).values({
    id: workspaceId,
    name: workspaceName,
    slug: workspaceName,
  });

  await db
    .update(user)
    .set({ activeWorkspaceId: workspaceId })
    .where(eq(user.id, userId));

  // Create admin role for workspace
  const roleId = crypto.randomUUID();
  await db.insert(role).values({
    id: roleId,
    name: "Admin",
    workspaceId,
  });

  await db.insert(rolePermission).values({
    roleId,
    permission: "*",
  });

  await db.insert(entityRole).values({
    roleId,
    entityType: "user",
    entityId: userId,
    scopeType: "workspace",
    scopeId: workspaceId,
  });

  const { apiKey, prefix, keyHash } = generateApiKey();
  await db.insert(userApiKey).values({
    userId,
    name: "e2e-ci-key",
    keyPrefix: prefix,
    keyHash,
    keyPreview: `${prefix}.****`,
  });

  const stateDir = path.join(__dirname, ".state");
  fs.mkdirSync(stateDir, { recursive: true });

  fs.writeFileSync(
    path.join(stateDir, "workspace.json"),
    JSON.stringify({
      name: workspaceName,
      slug: workspaceName,
      apiKey,
      secondaryApiKey: apiKey,
      id: workspaceId,
    }),
  );

  fs.writeFileSync(
    path.join(stateDir, "user.json"),
    JSON.stringify({ cookies: [], origins: [] }),
  );

  console.log(`Workspace: ${workspaceName} (${workspaceId})`);
  console.log(`API Key: ${apiKey}`);
  console.log("State files written to .state/");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
