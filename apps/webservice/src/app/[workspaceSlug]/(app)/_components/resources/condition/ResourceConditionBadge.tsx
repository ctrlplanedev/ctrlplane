import type {
  CreatedAtCondition,
  MetadataCondition,
} from "@ctrlplane/validators/conditions";
import type {
  ComparisonCondition,
  IdentifierCondition,
  KindCondition,
  LastSyncCondition,
  NameCondition,
  ProviderCondition,
  ResourceCondition,
  VersionCondition,
} from "@ctrlplane/validators/resources";
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
import { ColumnOperator, DateOperator } from "@ctrlplane/validators/conditions";
import {
  isComparisonCondition,
  isCreatedAtCondition,
  isIdentifierCondition,
  isKindCondition,
  isLastSyncCondition,
  isMetadataCondition,
  isNameCondition,
  isProviderCondition,
  isVersionCondition,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";

const operatorVerbs = {
  [ResourceOperator.And]: "and",
  [ResourceOperator.Or]: "or",
  [ResourceOperator.Equals]: "is",
  [ResourceOperator.Null]: (
    <span>
      is <span className="text-orange-500">null</span>
    </span>
  ),
  [ResourceOperator.Like]: "contains",
  [ColumnOperator.StartsWith]: "starts with",
  [ColumnOperator.EndsWith]: "ends with",
  [ColumnOperator.Contains]: "contains",
  [DateOperator.Before]: "before",
  [DateOperator.After]: "after",
  [DateOperator.BeforeOrOn]: "before or on",
  [DateOperator.AfterOrOn]: "after or on",
};

const ConditionBadge: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <Badge
    variant="outline"
    // className="mx-1 w-fit bg-neutral-800/60 px-1 hover:bg-neutral-800/60"
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
          <StringifiedResourceCondition
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
          <StringifiedResourceCondition
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

const StringifiedKindCondition: React.FC<{
  condition: KindCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">Kind</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}
    </span>
    <span className="text-white">{condition.value}</span>
  </ConditionBadge>
);

const StringifiedNameCondition: React.FC<{
  condition: NameCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">Name</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}
    </span>
    <span className="text-white">{condition.value.replace(/%/g, "")}</span>
  </ConditionBadge>
);

const StringifiedIdentifierCondition: React.FC<{
  condition: IdentifierCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">Identifier</span>
    <span className="text-muted-foreground">
      {operatorVerbs[condition.operator]}
    </span>
    <span className="text-white">{condition.value.replace(/%/g, "")}</span>
  </ConditionBadge>
);

const StringifiedProviderCondition: React.FC<{
  condition: ProviderCondition;
}> = ({ condition }) => {
  const provider = api.resource.provider.byId.useQuery(condition.value);

  return (
    <ConditionBadge>
      <span className="text-white">Provider</span>
      <span className="text-muted-foreground">
        {operatorVerbs[condition.operator]}
      </span>
      <span className="text-white">{provider.data?.name}</span>
    </ConditionBadge>
  );
};

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

const StringifiedLastSyncCondition: React.FC<{
  condition: LastSyncCondition;
}> = ({ condition }) => (
  <ConditionBadge>
    <span className="text-white">last sync</span>
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
    <span className="text-white">{condition.value}</span>
  </ConditionBadge>
);

const StringifiedResourceCondition: React.FC<{
  condition: ResourceCondition;
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

  if (isIdentifierCondition(condition))
    return <StringifiedIdentifierCondition condition={condition} />;

  if (isProviderCondition(condition))
    return <StringifiedProviderCondition condition={condition} />;

  if (isCreatedAtCondition(condition))
    return <StringifiedCreatedAtCondition condition={condition} />;

  if (isLastSyncCondition(condition))
    return <StringifiedLastSyncCondition condition={condition} />;

  if (isVersionCondition(condition))
    return <StringifiedVersionCondition condition={condition} />;
};

export const ResourceConditionBadge: React.FC<{
  condition: ResourceCondition;
  tabbed?: boolean;
}> = ({ condition, tabbed = false }) => (
  <HoverCard>
    <HoverCardTrigger asChild>
      <div className="cursor-pointer rounded-lg bg-inherit text-xs text-muted-foreground">
        <StringifiedResourceCondition condition={condition} truncate />
      </div>
    </HoverCardTrigger>
    <HoverCardContent align="start" className={cn("w-full")}>
      <div className="cursor-pointer rounded-lg bg-neutral-950 text-xs text-muted-foreground">
        <StringifiedResourceCondition condition={condition} tabbed={tabbed} />
      </div>
    </HoverCardContent>
  </HoverCard>
);
