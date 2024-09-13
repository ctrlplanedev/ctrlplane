"use client";

import { Input } from "@ctrlplane/ui/input";

import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { useDashboardContext } from "../DashboardContext";
import { widgets } from "../widgets";

export const WidgetMenu: React.FC = () => {
  const { setDroppingItem, editMode } = useDashboardContext();
  const { search, setSearch, result } = useMatchSorterWithSearch(
    Object.entries(widgets),
    { keys: ["0", "1.displayName"] },
  );
  if (!editMode) return null;
  return (
    <div className="z-10 shrink-0 space-y-6 border-b py-6">
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

      <div className="flex items-center gap-4 overflow-x-auto px-6">
        {result.map(([name, widget]) => {
          const { ComponentPreview } = widget;
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
              className="relative h-[130px] w-[160px] shrink-0 cursor-grab select-none rounded-md border px-4 py-1.5"
            >
              <ComponentPreview />
            </div>
          );
        })}
      </div>
    </div>
  );
};
