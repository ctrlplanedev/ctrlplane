import { Metadata } from "next";
import { notFound } from "next/navigation";

import { desc, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Card, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";

export const metadata: Metadata = {
  title: "Admin Dashboard | Ctrlplane",
  description: "Administrative dashboard for managing Ctrlplane users and workspaces."
};

export default async function AdminPage() {
  const viewer = await api.user.viewer().catch(() => null);
  if (viewer == null) return notFound();
  if (viewer.systemRole !== "admin") return notFound();

  const users = await db
    .select()
    .from(schema.user)
    .orderBy(desc(schema.user.createdAt))
    .limit(500);
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.user)
    .then(([result]) => result?.count ?? 0);

  const workspaces = await db
    .select()
    .from(schema.workspace)
    .orderBy(desc(schema.workspace.createdAt))
    .limit(500);
  const workspaceCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.workspace)
    .then(([result]) => result?.count ?? 0);

  return (
    <div className="container mx-auto max-w-6xl space-y-10 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Users ({count})</CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={user.image ?? undefined} />
                      <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.systemRole}</TableCell>
                <TableCell>{user.createdAt.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspaces ({workspaceCount})</CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>id</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Google SA</TableHead>
              <TableHead>AWS Role</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((workspace) => (
              <TableRow key={workspace.id}>
                <TableCell>{workspace.id}</TableCell>
                <TableCell>
                  {workspace.name} ({workspace.slug})
                </TableCell>
                <TableCell>{workspace.googleServiceAccountEmail}</TableCell>
                <TableCell>{workspace.awsRoleArn}</TableCell>
                <TableCell>{workspace.createdAt.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
