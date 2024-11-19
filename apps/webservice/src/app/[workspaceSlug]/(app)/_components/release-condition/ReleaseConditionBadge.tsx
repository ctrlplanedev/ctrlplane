import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type {
  ComparisonCondition,
  ReleaseCondition,
} from "@ctrlplane/validators/releases";
import React from "react";
import { format } from "date-fns";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { DateOperator } from "@ctrlplane/validators/conditions";
import {
  isComparisonCondition,
  isCreatedAtCondition,
  isMetadataCondition,
  isVersionCondition,
  ReleaseOperator,
} from "@ctrlplane/validators/releases";

const operatorVerbs = {
  [ReleaseOperator.And]: "and",
  [ReleaseOperator.Or]: "or",
  [ReleaseOperator.Equals]: "is",
  [ReleaseOperator.Null]: (
    <span>
      is <span className="text-orange-500">null</span>
    </span>
  ),
  [ReleaseOperator.Regex]: "matches",
  [ReleaseOperator.Like]: "contains",
  [DateOperator.After]: "after",
  [DateOperator.Before]: "before",
  [DateOperator.AfterOrOn]: "after or on",
  [DateOperator.BeforeOrOn]: "before or on",
};

const ConditionBadge: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <Badge
    variant="outline"
    className="text-sx h-7 gap-1.5 bg-neutral-900 px-2 font-normal"
  >
    {children}
  </Badge>
);

const StringifiedComparisonCondition: React.FC<{
  condition: ComparisonCondition;
  depth?: number;
  truncate?: boolean;
}> = ({ condition, depth = 0, truncate = false }) => (
  <>
    {depth !== 0 && (
      <span
        className={cn(
          "mx-1 font-bold",
          depth === 1 && "text-blue-500",
          depth === 2 && "text-purple-500",
          depth === 3 && "text-amber-500",
        )}
      >
        (
      </span>
    )}
    {depth === 0 || !truncate ? (
      condition.conditions.map((subCondition, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="mx-1 text-xs text-neutral-400">
              {operatorVerbs[condition.operator]}
            </span>
          )}
          <StringifiedReleaseCondition
            condition={subCondition}
            depth={depth + 1}
            truncate={truncate}
          />
        </React.Fragment>
      ))
    ) : (
      <span className="text-muted-foreground">...</span>
    )}

    {depth !== 0 && (
      <span
        className={cn(
          "mx-1 font-bold",
          depth === 1 && "text-blue-500",
          depth === 2 && "text-purple-500",
          depth === 3 && "text-amber-500",
        )}
      >
        )
      </span>
    )}
  </>
);

const StringifiedTabbedComparisonCondition: React.FC<{
  condition: ComparisonCondition;
  depth?: number;
}> = ({ condition, depth = 0 }) => {
  const [comparisonSubConditions, otherSubConditions] = _.partition(
    condition.conditions,
    (subCondition) => isComparisonCondition(subCondition),
  );
  const conditionsOrdered = [...otherSubConditions, ...comparisonSubConditions];

  return (
    <div
      className={cn("space-y-1", depth === 1 && "pl-2", depth === 2 && "pl-4")}
    >
      {conditionsOrdered.map((subCondition, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <div className="mx-1 text-neutral-400">
              {operatorVerbs[condition.operator]}
            </div>
          )}
          <StringifiedReleaseCondition
            condition={subCondition}
            depth={depth + 1}
            tabbed
          />
        </React.Fragment>
      ))}
    </div>
  );
};

const StringifiedMetadataCondition: React.FC<{
  condition: MetadataCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">{condition.key}</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator ?? "equals"]}
    </span>
    {condition.value != null && (
      <span className="text-white">{condition.value}</span>
    )}
  </ConditionBadge>
);

const StringifiedCreatedAtCondition: React.FC<{
  condition: CreatedAtCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">created</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}
    </span>
    <span className="text-white">
      {format(condition.value, "MMM d, yyyy, h:mma")}
    </span>
  </ConditionBadge>
);

const StringifiedVersionCondition: React.FC<{
  condition: VersionCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">version</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}
    </span>
    <span className="text-white">{condition.value.replace(/%/g, "")}</span>
  </ConditionBadge>
);

const StringifiedReleaseCondition: React.FC<{
  condition: ReleaseCondition;
  depth?: number;
  truncate?: boolean;
  tabbed?: boolean;
}> = ({ condition, depth = 0, truncate = false, tabbed = false }) => {
  if (isComparisonCondition(condition))
    return tabbed ? (
      <StringifiedTabbedComparisonCondition
        condition={condition}
        depth={depth}
      />
    ) : (
      <StringifiedComparisonCondition
        condition={condition}
        depth={depth}
        truncate={truncate}
      />
    );

  if (isMetadataCondition(condition))
    return <StringifiedMetadataCondition condition={condition} />;

  if (isCreatedAtCondition(condition))
    return <StringifiedCreatedAtCondition condition={condition} />;

  if (isVersionCondition(condition))
    return <StringifiedVersionCondition condition={condition} />;
};

export const ReleaseConditionBadge: React.FC<{
  condition: ReleaseCondition;
  tabbed?: boolean;
}> = ({ condition, tabbed = false }) => (
  <HoverCard>
    <HoverCardTrigger asChild>
      <div className="cursor-pointer rounded-lg bg-inherit text-xs text-muted-foreground">
        <StringifiedReleaseCondition condition={condition} truncate />
      </div>
    </HoverCardTrigger>
    <HoverCardContent align="start" className="w-full">
      <div className="cursor-pointer rounded-lg bg-neutral-950 text-xs text-muted-foreground">
        <StringifiedReleaseCondition condition={condition} tabbed={tabbed} />
      </div>
    </HoverCardContent>
  </HoverCard>
);