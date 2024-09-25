"use client";

import type {
  EqualCondition,
  LikeCondition,
  MetadataCondition,
  NullCondition,
  RegexCondition,
} from "@ctrlplane/validators/targets";
import { useState } from "react";
import { IconX } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";

export const MetadataFilterInput: React.FC<{
  workspaceId?: string;
  value: MetadataCondition;
  onChange: (value: MetadataCondition) => void;
  onRemove?: () => void;
  selectedKeys?: string[];
  numInputs?: number;
}> = ({
  workspaceId,
  value,
  onChange,
  onRemove,
  selectedKeys = [],
  numInputs,
}) => {
  const [open, setOpen] = useState(false);
  const metadataKeys = api.target.metadataKeys.useQuery(workspaceId ?? "", {
    enabled: workspaceId != null,
  });
  const filteredMetadataKeys = useMatchSorter(
    metadataKeys.data ?? [],
    value.key,
  ).filter((k) => !selectedKeys.includes(k));
  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-8">
        <div className="col-span-3">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              onClick={(e) => e.stopPropagation()}
              className="flex-grow rounded-r-none"
            >
              <Input
                placeholder="Key"
                value={value.key}
                onChange={(e) =>
                  onChange({
                    ...value,
                    key: e.target.value,
                  })
                }
                className="rounded-r-none"
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
        </div>
        <div className="col-span-2">
          <Select
            value={value.operator}
            onValueChange={(v: "equals" | "regex" | "like" | "null") =>
              v === "null"
                ? onChange({
                    key: value.key,
                    operator: "null",
                  } as NullCondition)
                : onChange({ ...value, operator: v } as
                    | EqualCondition
                    | RegexCondition
                    | LikeCondition)
            }
          >
            <SelectTrigger className="rounded-none">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="regex">Regex</SelectItem>
              <SelectItem value="like">Like</SelectItem>
              <SelectItem value="null">Is Null</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {value.operator !== "null" ? (
          <div className="col-span-3">
            <Input
              placeholder={
                value.operator === "regex"
                  ? "^[a-zA-Z]+$"
                  : value.operator === "like"
                    ? "%value%"
                    : "Value"
              }
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
              className="rounded-l-none"
            />
          </div>
        ) : (
          <div className="col-span-3 h-9  cursor-not-allowed rounded-r-md bg-neutral-900 bg-opacity-50" />
        )}
      </div>

      {(numInputs == null || numInputs > 1) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
        >
          <IconX />
        </Button>
      )}
    </div>
  );
};
