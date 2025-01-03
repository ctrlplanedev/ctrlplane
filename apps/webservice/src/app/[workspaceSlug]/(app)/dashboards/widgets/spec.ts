import type { Workspace } from "@ctrlplane/db/schema";

export type Dimensions = { width: number; height: number };

export interface WidgetProps<Config> {
  config: Config;
  updateConfig: (c: Config) => void;
}

export type WidgetFC<Config = any> = React.FC<
  WidgetProps<Config> & {
    isEditMode: boolean;
    onDelete: () => void;
    workspace: Workspace;
  }
>;

export type Widget<Config = any> = {
  displayName: string;
  description: string;

  dimensions?: {
    suggestedH?: number;
    suggestedW?: number;
    minW?: number;
    minH?: number;
    maxH?: number;
    maxW?: number;
  };

  Icon: React.FC;
  Component: WidgetFC<Config>;
};
