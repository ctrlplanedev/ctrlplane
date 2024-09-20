"use client";

import { useState } from "react";
import { TbX } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";

export const MetadataFilterInput: React.FC<{
  workspaceId?: string;
  value: { key: string; value: string };
  onChange: (value: { key: string; value: string }) => void;
  onRemove?: () => void;
  numInputs: number;
}> = ({ workspaceId, value, onChange, onRemove, numInputs }) => {
  const [open, setOpen] = useState(false);
  const metadataKeys = api.target.metadataKeys.useQuery(workspaceId ?? "", {
    enabled: workspaceId != null,
  });
  const filteredMetadataKeys = useMatchSorter(
    metadataKeys.data ?? [],
    value.key,
  );
  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          onClick={(e) => e.stopPropagation()}
          className="flex-grow"
        >
          <Input
            placeholder="Key"
            value={value.key}
            onChange={(e) => onChange({ ...value, key: e.target.value })}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[300px] overflow-x-auto p-0 text-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filteredMetadataKeys.map((k) => (
            <Button
              variant="ghost"
              size="sm"
              key={k}
              className="w-full rounded-none text-left"
              onClick={(e) => {
                e.preventDefault();
                onChange({ ...value, key: k });
              }}
            >
              <div className="w-full">{k}</div>
            </Button>
          ))}
        </PopoverContent>
      </Popover>
      <div className="flex-grow">
        <Input
          placeholder="Value"
          value={value.value}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
        />
      </div>
      {numInputs > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
        >
          <TbX />
        </Button>
      )}
    </div>
  );
};
