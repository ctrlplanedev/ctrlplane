import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { IconLoader2, IconRocket } from "@tabler/icons-react";
import { z } from "zod";

import type { DashboardWidget } from "../../DashboardWidget";
import { api } from "~/trpc/react";
import { DashboardWidgetCard } from "../../DashboardWidget";
import { EditReleaseTargetModule } from "./Edit";
import { ExpandedReleaseTargetModule } from "./ExpandedModule";
import { ReleaseTargetTile } from "./ReleaseTargetTile";

const widgetSchema = z.object({ releaseTargetId: z.string().uuid() });

const InvalidConfig: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center">
    <p className="text-sm text-muted-foreground">Invalid config</p>
  </div>
);

const ReleaseTargetModule: React.FC<{
  widget: schema.DashboardWidget;
}> = ({ widget }) => {
  const { config } = widget;
  const parsedConfig = widgetSchema.safeParse(config);
  const isValidConfig = parsedConfig.success;

  const { data, isLoading } =
    api.dashboard.widget.data.releaseTargetModule.summary.useQuery(
      parsedConfig.data?.releaseTargetId ?? "",
      { enabled: isValidConfig },
    );

  const isInvalid = !isValidConfig || data == null;

  return (
    <DashboardWidgetCard
      widget={widget}
      WidgetExpandedComp={
        data != null ? (
          <ExpandedReleaseTargetModule releaseTarget={data} />
        ) : (
          <InvalidConfig />
        )
      }
      WidgetEditingComp={
        <EditReleaseTargetModule widget={widget} releaseTarget={data} />
      }
    >
      {isLoading && (
        <div className="flex h-full w-full items-center justify-center">
          <IconLoader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {!isLoading && isInvalid && <InvalidConfig />}
      {!isLoading && data != null && (
        <ReleaseTargetTile widgetId={widget.id} releaseTarget={data} />
      )}
    </DashboardWidgetCard>
  );
};

export const WidgetReleaseTargetModule: DashboardWidget = {
  displayName: "Resource Deployment",
  Icon: (props) => <IconRocket {...props} />,
  Component: ReleaseTargetModule,
};
