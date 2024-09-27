import type {
  ComparisonCondition,
  KindCondition,
  MetadataCondition,
  NameCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import React from "react";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import {
  isComparisonCondition,
  isKindCondition,
  isMetadataCondition,
  isNameCondition,
  TargetOperator,
} from "@ctrlplane/validators/targets";

const operatorVerbs = {
  [TargetOperator.And]: "and",
  [TargetOperator.Or]: "or",
  [TargetOperator.Equals]: "is",
  [TargetOperator.Null]: (
    <span>
      is&nbsp;&nbsp;<span className="text-orange-500">null</span>
    </span>
  ),
  [TargetOperator.Regex]: "matches",
  [TargetOperator.Like]: "contains",
};

const ConditionBadge: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <Badge
    variant="secondary"
    className="mx-1 w-fit bg-neutral-800/60 px-1 hover:bg-neutral-800/60"
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
    <span
      className={cn(
        "mx-1 font-bold",
        depth === 0 && "text-blue-500",
        depth === 1 && "text-purple-500",
        depth === 2 && "text-amber-500",
      )}
    >
      (
    </span>
    {depth === 0 || !truncate ? (
      condition.conditions.map((subCondition, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="mx-1 text-neutral-400">
              {operatorVerbs[condition.operator]}
            </span>
          )}
          <StringifiedTargetCondition
            condition={subCondition}
            depth={depth + 1}
            truncate={truncate}
          />
        </React.Fragment>
      ))
    ) : (
      <span className="text-muted-foreground">...</span>
    )}

    <span
      className={cn(
        "mx-1 font-bold",
        depth === 0 && "text-blue-500",
        depth === 1 && "text-purple-500",
        depth === 2 && "text-amber-500",
      )}
    >
      )
    </span>
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
          <StringifiedTargetCondition
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
    <span className="text-green-400">"{condition.key}"&nbsp;&nbsp;</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator ?? "equals"]}&nbsp;&nbsp;
    </span>
    {condition.value != null && (
      <span className="text-red-400">"{condition.value}"</span>
    )}
  </ConditionBadge>
);

const StringifiedKindCondition: React.FC<{
  condition: KindCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-green-400">kind&nbsp;&nbsp;</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}&nbsp;&nbsp;
    </span>
    <span className="text-red-400">"{condition.value}"</span>
  </ConditionBadge>
);

const StringifiedNameCondition: React.FC<{
  condition: NameCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-green-400">name&nbsp;&nbsp;</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}&nbsp;&nbsp;
    </span>
    <span className="text-red-400">"{condition.value.replace(/%/g, "")}"</span>
  </ConditionBadge>
);

const StringifiedTargetCondition: React.FC<{
  condition: TargetCondition;
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

  if (isKindCondition(condition))
    return <StringifiedKindCondition condition={condition} />;

  if (isNameCondition(condition))
    return <StringifiedNameCondition condition={condition} />;
};

export const TargetConditionBadge: React.FC<{
  condition: TargetCondition;
  tabbed?: boolean;
}> = ({ condition, tabbed = false }) => (
  <HoverCard>
    <HoverCardTrigger asChild>
      <div className="cursor-pointer rounded-lg bg-neutral-950 p-2 text-muted-foreground">
        <StringifiedTargetCondition condition={condition} truncate />
      </div>
    </HoverCardTrigger>
    <HoverCardContent align="start" className={cn(!tabbed && "w-max")}>
      <div className="cursor-pointer rounded-lg bg-neutral-950 text-muted-foreground">
        <StringifiedTargetCondition condition={condition} tabbed={tabbed} />
      </div>
    </HoverCardContent>
  </HoverCard>
);
