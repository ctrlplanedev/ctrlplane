import { useState } from "react";
import { IconHeading } from "@tabler/icons-react";
import { useDebounce } from "react-use";

import { Input } from "@ctrlplane/ui/input";

import type { Widget } from "../DashboardWidget";
import { MoveButton } from "../MoveButton";

type WidgetHeadingConfig = { content?: string };

export const WidgetHeading: Widget<WidgetHeadingConfig> = {
  displayName: "Heading",
  description: "A heading for your dashboard",
  Icon: () => <IconHeading className="h-10 w-10 stroke-1" />,
  Component: ({ config, updateConfig, isEditMode, isUpdating }) => {
    const [content, setContent] = useState(config.content ?? "My heading");

    useDebounce(() => updateConfig({ content }), 500, [content]);

    return (
      <div className="flex h-full w-full flex-col px-2 py-2">
        <div className="grow" />

        <div className="flex items-center">
          {isEditMode && (
            <div className="mr-2">
              <MoveButton />
            </div>
          )}

          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!isEditMode || isUpdating}
            className="w-full grow rounded-md border border-transparent bg-transparent pl-1 text-xl font-semibold text-neutral-300 focus:border-neutral-500 focus:outline-none"
          />
        </div>
      </div>
    );
  },
};
