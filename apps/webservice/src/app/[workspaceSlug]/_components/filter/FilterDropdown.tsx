import type { JSXElementConstructor } from "react";
import React, { useState } from "react";
import { TbFilter } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { Filter } from "./Filter";
import { KindFilterDialog } from "../../(targets)/targets/KindFilterDialog";
import { MetadataFilterDialog } from "../../(targets)/targets/MetadataFilterDialog";
import { NameFilterDialog } from "../../(targets)/targets/NameFilterDialog";
import { ContentDialog } from "./FilterDropdownItems";

const dialogs: Array<string | JSXElementConstructor<any>> = [
  ContentDialog,
  MetadataFilterDialog,
  NameFilterDialog,
  KindFilterDialog,
];

const isDialog = (type: string | JSXElementConstructor<any>) =>
  dialogs.includes(type) || ((type as any).name as string).includes("Dialog");

interface FilterProps<T extends Filter<string, any>> {
  property: string;
  options?: string[];
  children?: React.ReactNode;
  onChange?: (filter: T) => void;
}

export const FilterDropdown = <T extends Filter<string, any>>({
  filters,
  addFilters,
  children,
  className,
}: {
  filters: T[];
  addFilters: (newFilters: T[]) => void;
  children: React.ReactNode;
  className: string;
}) => {
  const [open, setOpen] = useState(false);
  const [openContent, setOpenContent] = useState("");

  return (
    <DropdownMenu
      open={open}
      onOpenChange={() => {
        setOpen(!open);
        if (!open) setOpenContent("");
      }}
    >
      <DropdownMenuTrigger asChild>
        {filters.length === 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="flex h-7 items-center gap-1"
          >
            <TbFilter /> Filter
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="flex h-7 w-7 items-center gap-1 text-xs"
          >
            <TbFilter />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className={className} align="start">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement<FilterProps<T>>(child)) return null;
          if (isDialog(child.type)) return null;

          const { property } = child.props;
          if (openContent === property)
            return React.cloneElement(child, {
              onChange: (filter: T) => {
                addFilters([filter]);
                setOpenContent("");
                setOpen(false);
              },
            });
        })}

        {openContent === "" &&
          React.Children.map(children, (child) => {
            if (!React.isValidElement<FilterProps<T>>(child)) return null;

            const { property, children } = child.props;

            const c = children ? (
              <span className="flex items-center gap-2">{children}</span>
            ) : (
              property
            );

            if (isDialog(child.type))
              return React.cloneElement(child, {
                onChange: (filter: T) => {
                  addFilters([filter]);
                  setOpenContent("");
                  setOpen(false);
                },
                children: (
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    {c}
                  </DropdownMenuItem>
                ),
              });

            return (
              <DropdownMenuItem
                key={property}
                onClick={(e) => {
                  e.preventDefault();
                  setOpenContent(property);
                }}
              >
                {c}
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
