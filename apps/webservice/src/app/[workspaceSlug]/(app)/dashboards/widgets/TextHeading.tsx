import { IconTextPlus, IconX } from "@tabler/icons-react";

import type { Widget } from "./spec";
import { MoveButton } from "./HelperButton";

export const WidgetHeading: Widget<{
  content?: string;
}> = {
  displayName: "Heading",
  description: "",
  dimensions: {
    suggestedH: 1,
    suggestedW: 4,
    maxH: 1,
    minW: 2,
  },
  Icon: () => <IconTextPlus className="h-10 w-10" />,
  Component: ({ config, isEditMode, onDelete, updateConfig }) => {
    return (
      <div className="flex h-full w-full flex-col px-2 py-2">
        <div className="grow" />

        <div className="flex items-center">
          {isEditMode && (
            <div className="mr-2">
              <MoveButton />
            </div>
          )}

          <div
            contentEditable={isEditMode}
            suppressContentEditableWarning
            className="w-full grow rounded-md border border-transparent bg-transparent pl-1 text-xl font-semibold text-neutral-300 focus:border-neutral-500 focus:outline-none"
            onChange={(e) =>
              updateConfig({ content: e.currentTarget.innerText })
            }
          >
            {config.content ?? "My heading"}
          </div>
          {isEditMode && (
            <button onClick={onDelete} className="mx-2 hover:text-red-400">
              <IconX />
            </button>
          )}
        </div>
      </div>
    );
  },
};
