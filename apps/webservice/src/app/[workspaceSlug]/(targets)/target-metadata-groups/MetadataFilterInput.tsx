import { useState } from "react";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

type MetadataFilterInputProps = {
  value: string;
  workspaceId: string;
  selectedKeys?: string[];
  selectedKinds?: string[];
  onChange: (value: string) => void;
};

export const MetadataFilterInput: React.FC<MetadataFilterInputProps> = ({
  value,
  workspaceId,
  selectedKeys = [],
  selectedKinds = [],
  onChange,
}) => {
  const [open, setOpen] = useState(false);

  const { data: metadataKeys } = api.target.metadataKeys.useQuery({
    workspaceId,
    kinds: selectedKinds,
  });

  const filteredLabels = metadataKeys
    ? metadataKeys
        .filter((key) => !selectedKeys.includes(key))
        .filter((key) => key.includes(value))
    : [];

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
          {filteredLabels.map((key) => (
            <Button
              variant="ghost"
              size="sm"
              key={key}
              className="w-full rounded-none text-left"
              onClick={(e) => {
                e.preventDefault();
                onChange(key);
                setOpen(false);
              }}
            >
              <div className="w-full">{key}</div>
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};
