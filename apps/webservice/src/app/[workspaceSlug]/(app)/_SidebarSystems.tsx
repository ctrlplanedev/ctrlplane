// "use client";

// import type { System, Workspace } from "@ctrlplane/db/schema";
// import { useState } from "react";
// import { useParams } from "next/navigation";
// import {
//   IconChevronRight,
//   IconPlant,
//   IconPlus,
//   IconRun,
//   IconShip,
//   IconVariable,
// } from "@tabler/icons-react";
// import _ from "lodash";
// import { useLocalStorage } from "react-use";

// import { cn } from "@ctrlplane/ui";
// import { Button } from "@ctrlplane/ui/button";
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@ctrlplane/ui/collapsible";

// import { CreateSystemDialog } from "./_components/CreateSystem";
// import { useSidebar } from "./SidebarContext";
// import { SidebarLink } from "./SidebarLink";

// const SystemCollapsible: React.FC<{ system: System }> = ({ system }) => {
//   const { setActiveSidebarItem } = useSidebar();
//   const [open, setOpen] = useLocalStorage(
//     `sidebar-systems-${system.id}`,
//     "false",
//   );
//   const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
//   return (
//     <Collapsible
//       open={open === "true"}
//       onOpenChange={() => setOpen(open === "true" ? "false" : "true")}
//       className="space-y-1 text-sm"
//       onMouseEnter={() => setActiveSidebarItem(`systems:${system.id}`)}
//     >
//       <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-neutral-800/50">
//         <span className="truncate">{system.name}</span>
//         <IconChevronRight
//           className={cn(
//             "h-3 w-3 text-muted-foreground transition-all",
//             open === "true" && "rotate-90",
//           )}
//         />
//       </CollapsibleTrigger>
//       <CollapsibleContent className="ml-2">
//         <SidebarLink
//           href={`/${workspaceSlug}/systems/${system.slug}/deployments`}
//         >
//           <IconShip className="h-4 w-4 text-muted-foreground" /> Deployments
//         </SidebarLink>
//         <SidebarLink
//           href={`/${workspaceSlug}/systems/${system.slug}/environments`}
//         >
//           <IconPlant className="h-4 w-4 text-muted-foreground" /> Environments
//         </SidebarLink>
//         <SidebarLink href={`/${workspaceSlug}/systems/${system.slug}/runbooks`}>
//           <IconRun className="h-4 w-4 text-muted-foreground" /> Runbooks
//         </SidebarLink>
//         <SidebarLink
//           href={`/${workspaceSlug}/systems/${system.slug}/variable-sets`}
//         >
//           <IconVariable className="h-4 w-4 text-muted-foreground" /> Variable
//           Sets
//         </SidebarLink>
//       </CollapsibleContent>
//     </Collapsible>
//   );
// };

// export const SidebarSystems: React.FC<{
//   workspace: Workspace;
//   systems: System[];
// }> = ({ workspace, systems }) => {
//   const [open, setOpen] = useState(true);
//   return (
//     <Collapsible open={open} onOpenChange={setOpen} className="m-3 space-y-2">
//       <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
//         Your systems
//         <IconChevronRight
//           className={cn("h-3 w-3", open && "rotate-90", "transition-all")}
//         />
//       </CollapsibleTrigger>
//       <CollapsibleContent className="space-y-1">
//         {systems.length === 0 && (
//           <CreateSystemDialog workspace={workspace}>
//             <Button
//               className="flex w-full items-center justify-start gap-1.5 text-left"
//               variant="ghost"
//               size="sm"
//             >
//               <IconPlus className="h-4 w-4" /> New system
//             </Button>
//           </CreateSystemDialog>
//         )}
//         {systems.map((system) => (
//           <SystemCollapsible key={system.id} system={system} />
//         ))}
//       </CollapsibleContent>
//     </Collapsible>
//   );
// };
