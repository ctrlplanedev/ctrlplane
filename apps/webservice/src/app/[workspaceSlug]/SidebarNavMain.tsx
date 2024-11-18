"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronRight } from "@tabler/icons-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from "@ctrlplane/ui/sidebar";

import {
  SidebarMenuItemWithPopover,
  SidebarMenuSubItemWithPopover,
  useSidebarPopover,
} from "./(app)/AppSidebarPopoverContext";

type SubItem = {
  popoverId?: string;
  icon?: any;
  title: string;
  url: string;
  exact?: boolean;
};

type MainItem = {
  popoverId?: string;
  title: string;
  url?: string;
  icon?: any;
  isOpen?: boolean;
  items?: SubItem[];
};

const SidebarSubItem: React.FC<{ item: SubItem }> = ({ item }) => {
  const pathname = usePathname();
  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <SidebarMenuSubItemWithPopover popoverId={item.popoverId}>
      <SidebarMenuSubButton asChild isActive={pathname.startsWith(item.url)}>
        <Link
          href={item.url}
          onClick={() => {
            setActiveSidebarItem(null);
          }}
        >
          {item.icon && <item.icon className="text-neutral-400" />}
          <span>{item.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItemWithPopover>
  );
};

const SidebarItem: React.FC<{ item: MainItem }> = ({ item }) => {
  const [open, setOpen] = useState(item.isOpen);
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItemWithPopover popoverId={item.popoverId}>
        {item.url ? (
          <SidebarMenuButton asChild tooltip={item.title}>
            <Link href={item.url}>
              {item.icon && <item.icon className="text-neutral-400" />}
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            asChild
            className="cursor-pointer"
            tooltip={item.title}
            onClick={() => setOpen(!open)}
          >
            <div>
              {item.icon && <item.icon className="text-neutral-400" />}
              <span>{item.title}</span>
            </div>
          </SidebarMenuButton>
        )}
        {item.items?.length ? (
          <>
            <CollapsibleTrigger asChild>
              <SidebarMenuAction className="data-[state=open]:rotate-90">
                <IconChevronRight className="text-muted-foreground" />
                <span className="sr-only">Toggle</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.items.map((subItem) => (
                  <SidebarSubItem key={subItem.title} item={subItem} />
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        ) : null}
      </SidebarMenuItemWithPopover>
    </Collapsible>
  );
};

export const SidebarNavMain: React.FC<{
  title: string;
  items: MainItem[];
}> = ({ title, items }) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarItem key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
