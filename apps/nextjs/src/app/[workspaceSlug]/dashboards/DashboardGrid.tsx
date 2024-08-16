import type { Layout } from "react-grid-layout";
import type GridLayout from "react-grid-layout";
import { Responsive, WidthProvider } from "react-grid-layout";

export const MOVE_BUTTON_CLASS_NAME = "grid-item-grip";

export const ROW_PX = 50;
export const COLS = 8;

const GridResponsive = WidthProvider(Responsive);

export type DashboardGridProps = {
  layout: Layout[];
} & GridLayout.ResponsiveProps &
  GridLayout.WidthProviderProps;
export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  ...gridProps
}) => {
  return (
    <GridResponsive
      rowHeight={ROW_PX}
      breakpoints={{ lg: 0 }}
      cols={{ lg: COLS }}
      margin={[16, 16]}
      draggableHandle={`.${MOVE_BUTTON_CLASS_NAME}`}
      {...gridProps}
    >
      {children}
    </GridResponsive>
  );
};
