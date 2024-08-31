"use client";

import { useState } from "react";
import { useCopyToClipboard } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

// export const metadata = { title: "Profile" };

const CreateApiKey: React.FC = () => {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const create = api.user.apiKey.create.useMutation();
  const utils = api.useUtils();
  const [, copy] = useCopyToClipboard();
  return (
    <>
      <div className="flex items-center gap-4">
        <Input
          placeholder="name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
        <Button
          onClick={async () => {
            const apiKey = await create.mutateAsync({ name });
            setKey(apiKey.key);
            copy(apiKey.key);
            await utils.user.apiKey.list.invalidate();
          }}
        >
          Create new API key
        </Button>
      </div>
      <Dialog open={key != ""} onOpenChange={() => setKey("")}>
        <DialogContent className="space-y-5">
          <div>
            This key has been copied to clipboard. Please store it safely as it
            will only be visible this one time:
          </div>
          <code>{key}</code>
          <DialogFooter>
            <Button type="submit" onClick={() => setKey("")}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ListApiKeys: React.FC = () => {
  const list = api.user.apiKey.list.useQuery();
  const revoke = api.user.apiKey.revoke.useMutation();
  const utils = api.useUtils();
  return (
    <div className="rounded-md border bg-neutral-900/50">
      {list.data?.map((key, idx) => (
        <div
          key={key.id}
          className={cn(
            idx !== 0 && "border-t",
            "flex items-center justify-between gap-2 p-1",
          )}
        >
          <div className="flex-grow px-1">{key.name}</div>
          <div className="text-xs text-muted-foreground">
            <code>{key.keyPreview}...</code>
          </div>
          <Button
            className="rounded-md bg-transparent"
            size="sm"
            variant="outline"
            onClick={async () => {
              await revoke.mutateAsync(key.id);
              await utils.user.apiKey.list.invalidate();
            }}
          >
            Revoke
          </Button>
        </div>
      ))}
    </div>
  );
};

export default function AccountSettingApiPage() {
  return (
    <div className="container mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">API</h1>
      </div>
      <div className="border-b" />
      <div className="space-y-6">
        <div>General</div>
        <div className="text-sm text-muted-foreground">
          You can create personal API keys for accessing Ctrlplane's API to
          build your own integration or hacks.
        </div>

        <ListApiKeys />
        <CreateApiKey />
      </div>
    </div>
  );
}
