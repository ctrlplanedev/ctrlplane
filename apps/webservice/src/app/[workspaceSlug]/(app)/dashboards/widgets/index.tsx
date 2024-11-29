import type { Widget } from "./spec";
import { WidgetTargetMetadataCount } from "./TargetWidgets";
import { WidgetHeading } from "./TextHeading";

export * from "./spec";

export const widgets: Record<string, Widget> = {
  "target-annotation-pie": WidgetTargetMetadataCount,
  heading: WidgetHeading,
};
