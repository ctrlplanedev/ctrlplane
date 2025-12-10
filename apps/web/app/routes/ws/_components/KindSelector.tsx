import { capitalCase } from "change-case";
import { useSearchParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";

export function useKindFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = searchParams.get("kind") ?? undefined;
  const setKind = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("kind");
      setSearchParams(newParams);
      return;
    }
    newParams.set("kind", value);
    setSearchParams(newParams);
  };
  return { kind, setKind };
}

function useWorkspaceKinds() {
  const { workspace } = useWorkspace();
  const { data: kinds, isLoading } = trpc.resource.kinds.useQuery({
    workspaceId: workspace.id,
  });
  return { kinds: kinds ?? [], isLoading };
}

export function KindSelector() {
  const { kinds } = useWorkspaceKinds();
  const { kind, setKind } = useKindFilter();

  return (
    <Select value={kind ?? "all"} onValueChange={setKind}>
      <SelectTrigger>
        {kind == null || kind === "all"
          ? "Select kind"
          : capitalCase(kind ?? "")}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {kinds.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {capitalCase(kind)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
