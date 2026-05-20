import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

const WEB_VERSION = import.meta.env.VITE_CTRLPLANE_VERSION ?? "dev";

type ServiceVersions = {
  api: string;
  workspaceEngine: string | null;
};

function useServiceVersions() {
  return useQuery({
    queryKey: ["version"],
    queryFn: async (): Promise<ServiceVersions> => {
      const response = await fetch("/api/version");
      return response.json();
    },
    staleTime: Infinity,
  });
}

export function VersionBadge() {
  const { data } = useServiceVersions();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="self-start pl-3 font-mono text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          version: {WEB_VERSION}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>About Ctrlplane</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">web</dt>
          <dd className="font-mono">{WEB_VERSION}</dd>
          <dt className="text-muted-foreground">api</dt>
          <dd className="font-mono">{data?.api ?? "—"}</dd>
          <dt className="text-muted-foreground">workspace-engine</dt>
          <dd className="font-mono">{data?.workspaceEngine ?? "—"}</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
