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
} from "./AppSidebarPopoverContext";

export const SidebarNavMain: React.FC<{
  title: string;
  items: {
    popoverId?: string;
    title: string;
    url: string;
    icon?: any;
    isOpen?: boolean;
    items?: {
      popoverId?: string;
      icon?: any;
      title: string;
      url: string;
      exact?: boolean;
    }[];
  }[];
}> = ({ title, items }) => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isOpen}>
            <SidebarMenuItemWithPopover popoverId={item.popoverId}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <a href={item.url}>
                  {item.icon && <item.icon className="text-neutral-400" />}
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
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
                        <SidebarMenuSubItemWithPopover
                          popoverId={subItem.popoverId}
                          key={subItem.title}
                        >
                          <SidebarMenuSubButton asChild>
                            <a href={subItem.url}>
                              {subItem.icon && (
                                <subItem.icon className="text-neutral-400" />
                              )}
                              <span>{subItem.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItemWithPopover>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItemWithPopover>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
