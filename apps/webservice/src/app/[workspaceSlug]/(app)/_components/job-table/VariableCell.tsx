import type * as schema from "@ctrlplane/db/schema";

import { Button } from "@ctrlplane/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { TableCell } from "@ctrlplane/ui/table";

type VariableCellProps = {
  variables: schema.JobVariable[];
};

export const VariableCell: React.FC<VariableCellProps> = ({ variables }) => {
  return (
    <TableCell className="py-0">
      {variables.length > 0 && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6 px-2 py-0">
              {variables.length} variable{variables.length !== 1 ? "s" : ""}
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            align="center"
            className="flex max-w-60 flex-col gap-1 p-2"
          >
            {variables.map((v) => (
              <div key={v.id} className="text-xs">
                {v.key}: {String(v.value)}
              </div>
            ))}
          </HoverCardContent>
        </HoverCard>
      )}
    </TableCell>
  );
};
