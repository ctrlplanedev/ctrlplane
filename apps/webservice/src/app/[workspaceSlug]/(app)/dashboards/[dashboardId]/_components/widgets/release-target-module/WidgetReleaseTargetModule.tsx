import React from "react";
import { IconRocket } from "@tabler/icons-react";

import type { Widget } from "../../DashboardWidget";

type WidgetConfig = { releaseTargetId: string };

export const WidgetReleaseTargetModule: Widget<WidgetConfig> = {
  displayName: "Resource Deployment",
  description: "A module to summarize and deploy to a resource",
  Icon: (props) => <IconRocket {...props} />,
  Component: () => {
    return <div>hello</div>;
  },
};
