import { formatDistanceToNowStrict } from "date-fns";
import { TriangleAlert } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import type { ExpiryOption } from "./skip-expiry";

export type ExpirySelectProps = {
  options: ExpiryOption[];
  selectedId: string | undefined;
  onChange: (id: string) => void;
};

export function ExpirySelect({ options, selectedId, onChange }: ExpirySelectProps) {
  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">Expires</span>
      <Select value={selected?.id} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          {selected?.label ?? "Select when this skip expires"}
        </SelectTrigger>
        <SelectContent align="start">
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected != null && selected.value != null && (
        <p className="text-xs text-muted-foreground">
          Expires in {formatDistanceToNowStrict(selected.value)}
        </p>
      )}
      {selected != null && selected.value == null && (
        <p className="flex items-start gap-1.5 text-xs text-yellow-500">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          Not recommended — permanent skips can have unintended consequences down
          the line.
        </p>
      )}
    </div>
  );
}
