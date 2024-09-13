"use client";

import type { UserApiKey } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TbCheck, TbCopy } from "react-icons/tb";
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

  const router = useRouter();

  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(key);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };
  return (
    <>
      <div className="flex items-center gap-4">
        <Input
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
        <Button
          disabled={name.length === 0}
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
          <div className="relative flex items-center">
            <Input
              value={key}
              className="text-ellipsis pr-8 disabled:cursor-default"
              disabled
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleCopy}
              className="absolute right-2 h-4 w-4 bg-neutral-950 backdrop-blur-sm transition-all hover:bg-neutral-950 focus-visible:ring-0"
            >
              {isCopied ? (
                <TbCheck className="h-4 w-4 bg-neutral-950 text-green-500" />
              ) : (
                <TbCopy className="h-4 w-4" />
              )}
            </Button>
          </div>

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

export const ListApiKeys: React.FC<{ apiKeys: UserApiKey[] }> = ({
  apiKeys,
}) => {
  const revoke = api.user.apiKey.revoke.useMutation();
  const utils = api.useUtils();

  return (
    <div className="rounded-md border bg-neutral-900/50">
      {apiKeys.map((key, idx) => (
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
