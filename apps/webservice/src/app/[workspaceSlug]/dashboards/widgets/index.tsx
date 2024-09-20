import type { Widget } from "./spec";
import { MOVE_BUTTON_CLASS_NAME } from "../DashboardGrid";
import { WidgetTargetMetadataCount } from "./TargetWidgets";
import { WidgetHeading } from "./TextHeading";

export * from "./spec";

export const widgets: Record<string, Widget> = {
  test: {
    displayName: "TestWidget",
    description: "Hello",
    ComponentPreview: () => <>Test component</>,
    Component: () => {
      return (
        <div className="h-full rounded border border-neutral-800">
          <div className={`${MOVE_BUTTON_CLASS_NAME}`}>mover</div>
          test
        </div>
      );
    },
  },
  "target-annotation-pie": WidgetTargetMetadataCount,
  heading: WidgetHeading,
};
