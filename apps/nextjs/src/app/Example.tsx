import React, { useState } from "react";
import { useFieldArray } from "react-hook-form";
import { TbTextPlus } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Input } from "@ctrlplane/ui/input";

export const ContentFilter: React.FC<{
  children: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}> = ({ children, value, onChange }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </DialogContent>
    </Dialog>
  );
};

export const ItemContentFilter: React.FC<{
  children: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}> = ({ children, value, onChange }) => {
  return (
    <ContentFilter>
      <DropdownMenuItem>{children}</DropdownMenuItem>
    </ContentFilter>
  );
};

const NameFilter: React.FC<{ value: string }> = (props) => {
  return (
    <ContentFilter>
      <DropdownMenuItem>
        <TbTextPlus /> Name
      </DropdownMenuItem>
    </ContentFilter>
  );
};

export default function Example() {
  const [filters, setFilters] = useState<
    Array<{ key: "name" | "kind"; value: string }>
  >([]);
  const addFilter = setFilters(produce);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <ContentFilter property="kind">
          <TbTextPlus /> Kind
        </ContentFilter>
        <ContentFilter property="name">
          <TbTextPlus /> Name
        </ContentFilter>
        <DropdownSelector values={[]} property="name">
          <TbTextPlus /> Name
        </DropdownSelector>
        <NumberInput values={[]} property="name">
          <TbTextPlus /> Name
        </NumberInput>
        <DatePickerSelector values={[]} property="name">
          <TbTextPlus /> Name
        </DatePickerSelector>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
