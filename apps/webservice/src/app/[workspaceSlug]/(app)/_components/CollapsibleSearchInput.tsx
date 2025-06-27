"use client";

import { useEffect, useRef, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { useKey } from "react-use";

import { Button } from "@ctrlplane/ui/button";

export const CollapsibleSearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useKey("Escape", () => setIsExpanded(false));

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsExpanded((e) => !e)}
        className="flex h-7 w-7 flex-shrink-0 items-center gap-1 text-xs"
      >
        <IconSearch className="h-4 w-4" />
      </Button>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        ref={inputRef}
        type="text"
        className={`bg-transparent outline-none transition-all duration-200 ${
          isExpanded ? "w-[150px] pl-1" : "w-0"
        }`}
        placeholder="Search..."
        onBlur={() => setIsExpanded(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setIsExpanded(false);
        }}
      />
    </div>
  );
};
