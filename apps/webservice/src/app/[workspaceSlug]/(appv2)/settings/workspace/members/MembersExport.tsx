"use client";

import type { EntityRole, Role, User, Workspace } from "@ctrlplane/db/schema";

import { Button } from "@ctrlplane/ui/button";

type Member = {
  id: string;
  user: User;
  workspace: Workspace;
  entityRole: EntityRole;
  role: Role;
};

export const MembersExport: React.FC<{ data: Member[] }> = ({ data }) => {
  const exportCSV = () => {
    const headers = ["Name", "Email", "Role"];
    const csvContent = [
      headers.join(","),
      ...data.map(
        (member) =>
          `"${member.user.name}","${member.user.email}","${member.role.name}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "workspace_members.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex items-center">
      <div className="flex-grow">
        <p>Export members list</p>
        <p className="text-sm text-muted-foreground">
          Export a CSV with information of all members in your workspace.
        </p>
      </div>
      <Button variant="secondary" onClick={exportCSV}>
        Export CSV
      </Button>
    </div>
  );
};
