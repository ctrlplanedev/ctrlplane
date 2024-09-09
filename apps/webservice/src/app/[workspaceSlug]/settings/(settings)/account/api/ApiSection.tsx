"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCopyToClipboard } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

export const CreateApiKey: React.FC = () => {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const create = api.user.apiKey.create.useMutation();
  const utils = api.useUtils();
  const [, copy] = useCopyToClipboard();
  const router = useRouter();
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
            router.refresh();
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

export const ListApiKeys: React.FC = () => {
  const list = api.user.apiKey.list.useQuery();
  const revoke = api.user.apiKey.revoke.useMutation();
  const utils = api.useUtils();

  if (list.isLoading || list.data?.length === 0) return null;
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
