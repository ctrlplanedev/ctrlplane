import { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";

export const MetadataFilterInput: React.FC<{
  value: string;
  workspaceId: string;
  selectedKeys: string[];
  onChange: (value: string) => void;
}> = ({ value, workspaceId, selectedKeys = [], onChange }) => {
  const { data: metadataKeys } = api.target.metadataKeys.useQuery(workspaceId);
  const [open, setOpen] = useState(false);
  const filteredLabels = useMatchSorter(metadataKeys ?? [], value).filter(
    (k) => !selectedKeys.includes(k),
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
            className="h-8"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[300px] w-[23rem] overflow-auto p-0 text-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filteredLabels.map((k) => (
            <Button
              variant="ghost"
              size="sm"
              key={k}
              className="w-full rounded-none text-left"
              onClick={(e) => {
                e.preventDefault();
                onChange(k);
                setOpen(false);
              }}
            >
              <div className="w-full">{k}</div>
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};
