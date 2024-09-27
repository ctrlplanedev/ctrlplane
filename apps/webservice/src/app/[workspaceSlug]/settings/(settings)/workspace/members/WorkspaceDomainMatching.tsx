"use client";

import type {
  Role,
  Workspace,
  WorkspaceEmailDomainMatching,
} from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TbAt, TbX } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

const CreateDomainMatchingDialog: React.FC<{
  workspaceId: string;
  roles: Role[];
  children: React.ReactNode;
}> = ({ workspaceId, roles, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [roleId, setRoleId] = useState("");

  const create = api.workspace.emailDomainMatching.create.useMutation();
  const router = useRouter();
  const handleSubmit = async () => {
    // Handle form submission logic here
    console.log(`Adding domain: ${domain}`);
    setIsOpen(false);
    await create.mutateAsync({ workspaceId, roleId, domain });
    setDomain("");
    setRoleId("");
    router.refresh();
  };
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Domain Matching</DialogTitle>
            <DialogDescription>
              Specify a domain to automatically assign roles to new members with
              verified emails from that domain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="domain" className="mb-2 inline-block text-right">
                Domain
              </Label>
              <div className="relative col-span-3">
                <TbAt className="absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  id="domain"
                  placeholder="example.com"
                  className="col-span-3 pl-10"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="role" className="mb-2 inline-block text-right">
                Role
              </Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="w-[200px]">
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Add Domain</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const WorkspaceDomainMatching: React.FC<{
  workspace: Workspace;
  roles: Role[];
  domainMatching: WorkspaceEmailDomainMatching[];
}> = ({ roles, domainMatching, workspace }) => {
  const del = api.workspace.emailDomainMatching.delete.useMutation();
  const router = useRouter();
  return (
    <div>
      <div className="flex items-center">
        <div className="flex-grow">
          <p>Email Domain Matching</p>
          <p className="text-sm text-muted-foreground">
            Automatically invite members based on their email domain.
          </p>
        </div>
        <CreateDomainMatchingDialog workspaceId={workspace.id} roles={roles}>
          <Button variant="secondary">Add Domain</Button>
        </CreateDomainMatchingDialog>
      </div>

      {domainMatching.length > 0 && (
        <div className="mt-4">
          {domainMatching.map((dm) => (
            <div key={dm.id} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TbAt /> {dm.domain}
              </span>
              <span>{roles.find((r) => r.id === dm.roleId)?.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await del.mutateAsync(dm.id);
                  router.refresh();
                }}
              >
                <TbX />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
