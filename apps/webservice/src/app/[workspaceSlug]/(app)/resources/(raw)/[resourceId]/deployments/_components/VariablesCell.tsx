import { Badge } from "@ctrlplane/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";

type VariablesCellProps = {
  variables: Record<string, any>;
};

export const VariablesCell: React.FC<VariablesCellProps> = ({ variables }) => (
  <HoverCard>
    <HoverCardTrigger asChild>
      <Badge variant="secondary" className="cursor-pointer">
        {Object.keys(variables).length} variables
      </Badge>
    </HoverCardTrigger>
    <HoverCardContent>
      <div className="flex gap-2">
        <div className="flex-grow space-y-2">
          {Object.keys(variables).map((key) => (
            <div key={key} className="min-w-0 truncate">
              <span className="font-medium">{key}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Object.entries(variables).map(([key, value]) => (
            <div key={key}>
              <pre>{JSON.stringify(value, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
);
