export interface WidgetConfigProps<Config> {
  config: Config;
  updateConfig: (config: Config) => Promise<void>;
}

export type WidgetFC<Config> = React.FC<
  WidgetConfigProps<Config> & {
    isExpanded: boolean;
    setIsExpanded: (isExpanded: boolean) => void;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    isEditMode: boolean;
    onDelete: () => void;
  }
>;

export type Widget<Config = Record<string, any>> = {
  displayName: string;
  description: string;
  Icon: React.FC;

  dimensions?: {
    suggestedWidth?: number;
    suggestedHeight?: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
  };

  Component: WidgetFC<Config>;
};
