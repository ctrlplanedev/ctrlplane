import type { Widget } from "./spec";
import { WidgetResourceMetadataCount } from "./ResourceWidgets";
import { WidgetHeading } from "./TextHeading";

export * from "./spec";

export const widgets: Record<string, Widget> = {
  "resource-annotation-pie": WidgetResourceMetadataCount,
  heading: WidgetHeading,
};
