"use client";

import { IconX } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";

import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { useDashboardContext } from "../DashboardContext";
import { widgets } from "../widgets";

export const WidgetMenu: React.FC = () => {
  const { setDroppingItem, editMode, setEditMode } = useDashboardContext();
  const { search, setSearch, result } = useMatchSorterWithSearch(
    Object.entries(widgets),
    { keys: ["0", "1.displayName"] },
  );
  if (!editMode) return null;
  return (
    <div className="fixed bottom-0 right-0 top-[56px] z-10 m-2 w-[400px] space-y-6 rounded-md border bg-background/70 py-6 drop-shadow-2xl backdrop-blur-lg">
      <div className="absolute right-4 top-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0"
          onClick={() => setEditMode(false)}
        >
          <IconX className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </div>
      <div className="px-6">
        <p className="mb-2 text-sm text-muted-foreground">
          Drag and Drop new widgets onto your dashboard.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 px-4">
        {result.map(([name, widget]) => {
          const { Icon, displayName } = widget;
          return (
            <div
              key={name}
              draggable
              unselectable="on"
              // this is a hack for firefox
              // Firefox requires some kind of initialization
              // which we can do by adding this attribute
              // @see https://bugzilla.mozilla.org/show_bug.cgi?id=568313
              onDragStart={(e) => {
                const { dimensions } = widget;
                const item = {
                  w: dimensions?.suggestedW ?? dimensions?.minW ?? 2,
                  h: dimensions?.suggestedH ?? dimensions?.minH ?? 2,
                  widget: name,
                };
                setDroppingItem(item);
                e.dataTransfer.setData("text/plain", "");
              }}
              className="group relative w-full cursor-grab select-none space-y-1"
            >
              <div className="h-[110px] w-full rounded-md border group-hover:bg-neutral-500/5">
                <div className="flex h-full items-center justify-center">
                  <Icon />
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground group-hover:text-white">
                {displayName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
