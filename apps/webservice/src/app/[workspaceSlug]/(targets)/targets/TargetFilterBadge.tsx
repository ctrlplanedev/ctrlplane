import type { TargetCondition } from "@ctrlplane/validators/targets";
import React from "react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import {
  isComparisonCondition,
  isKindCondition,
  isMetadataCondition,
  isNameLikeCondition,
  TargetOperator,
} from "@ctrlplane/validators/targets";

const operatorVerbs = {
  [TargetOperator.And]: "AND",
  [TargetOperator.Or]: "OR",
  [TargetOperator.Equals]: "is",
  [TargetOperator.Null]: (
    <span>
      :&nbsp;<span className="text-orange-500">null</span>
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
    className="mx-1 bg-neutral-800/60 px-1 hover:bg-neutral-800/60"
  >
    {children}
  </Badge>
);

const StringifiedTargetCondition: React.FC<{
  condition: TargetCondition;
  depth?: number;
}> = ({ condition, depth = 0 }) => {
  if (isComparisonCondition(condition))
    return (
      <>
        <span
          className={cn(
            "mx-1 font-bold",
            depth === 0 && "text-blue-500",
            depth === 1 && "text-purple-500",
            depth === 2 && "text-emerald-500",
          )}
        >
          (
        </span>
        {condition.conditions.map((subCondition, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="mx-1 font-bold">
                {operatorVerbs[condition.operator]}
              </span>
            )}
            <StringifiedTargetCondition
              condition={subCondition}
              depth={depth + 1}
            />
          </React.Fragment>
        ))}
        <span
          className={cn(
            "mx-1 font-bold",
            depth === 0 && "text-blue-500",
            depth === 1 && "text-purple-500",
            depth === 2 && "text-emerald-500",
          )}
        >
          )
        </span>
      </>
    );

  if (isMetadataCondition(condition))
    return (
      <ConditionBadge>
        <span className="text-green-500">"{condition.key}"&nbsp;&nbsp;</span>
        <span className="text-muted-foreground">
          {operatorVerbs[condition.operator ?? "equals"]}&nbsp;&nbsp;
        </span>
        {condition.value != null && (
          <span className="text-red-500">"{condition.value}"</span>
        )}
      </ConditionBadge>
    );

  if (isKindCondition(condition))
    return (
      <ConditionBadge>
        <span className="text-green-500">kind&nbsp;&nbsp;</span>
        <span className="text-muted-foreground">
          {operatorVerbs[condition.operator]}&nbsp;&nbsp;
        </span>
        <span className="text-red-500">"{condition.value}"</span>
      </ConditionBadge>
    );

  if (isNameLikeCondition(condition))
    return (
      <ConditionBadge>
        <span className="text-green-500">name&nbsp;&nbsp;</span>
        <span className="text-muted-foreground">
          {operatorVerbs[condition.operator]}&nbsp;&nbsp;
        </span>
        <span className="text-red-500">
          "{condition.value.replace(/%/g, "")}"
        </span>
      </ConditionBadge>
    );
};

export const TargetConditionBadge: React.FC<{
  condition: TargetCondition;
}> = ({ condition }) => (
  <div className="cursor-pointer rounded-lg bg-neutral-950 p-2 text-muted-foreground">
    <StringifiedTargetCondition condition={condition} />
  </div>
);
