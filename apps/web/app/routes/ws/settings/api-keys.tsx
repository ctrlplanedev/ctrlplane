import type { RouterOutputs } from "@ctrlplane/trpc";
import { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type UserApiKey = RouterOutputs["user"]["apiKey"]["list"][number];

function CreateApiKey() {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const create = trpc.user.apiKey.create.useMutation();
  const utils = trpc.useUtils();

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
          data-testid="key-name"
          placeholder="Name"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          value={name}
        />
        <Button
          disabled={name.length === 0}
          data-testid="create-key"
          onClick={async () => {
            const apiKey = await create.mutateAsync({ name });
            setKey(apiKey.key);
            copy(apiKey.key);
            await utils.user.apiKey.list.invalidate();
            setName("");
          }}
        >
          Create new API key
        </Button>
      </div>
      <Dialog open={key !== ""} onOpenChange={() => setKey("")}>
        <DialogContent className="space-y-5">
          <div>
            This key has been copied to clipboard. Please store it safely as it
            will only be visible this one time:
          </div>
          <div className="relative flex items-center">
            <Input
              value={key}
              data-testid="key-value"
              className="text-ellipsis pr-8 disabled:cursor-default"
              disabled
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={handleCopy}
              className="absolute right-2 h-4 w-4 backdrop-blur-sm transition-all focus-visible:ring-0"
            >
              {isCopied ? (
                <IconCheck className="h-4 w-4 text-green-500" />
              ) : (
                <IconCopy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button
              data-testid="close-key-dialog"
              type="submit"
              onClick={() => setKey("")}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ListApiKeys({ apiKeys }: { apiKeys: UserApiKey[] }) {
  const revoke = trpc.user.apiKey.revoke.useMutation();
  const utils = trpc.useUtils();

  if (apiKeys.length === 0) {
    return (
      <div className="rounded-md border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        No API keys created yet.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/50">
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
}

export default function ApiKeysSettingsPage() {
  const { data: apiKeys, isLoading } = trpc.user.apiKey.list.useQuery();

  if (isLoading) {
    return (
      <div>
        <div className="container mx-auto max-w-2xl space-y-8 py-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">API Keys</h1>
          </div>
          <div className="border-b" />
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You can create personal API keys for accessing Ctrlplane's API to
          build your own integration or hacks.
        </p>
      </div>

      <ListApiKeys apiKeys={apiKeys ?? []} />
      <CreateApiKey />
    </div>
  );
}
