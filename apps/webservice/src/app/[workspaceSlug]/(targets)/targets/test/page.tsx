"use client";

import type { TargetCondition } from "@ctrlplane/validators/targets";
import { useState } from "react";

import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { TargetConditionRender } from "../../../_components/target-filter/TargetConditionRender";

const testTargetCondition: TargetCondition = {
  type: TargetFilterType.Comparison,
  operator: TargetOperator.And,
  conditions: [],
};

export default function TargetsTestPage() {
  const [condition, setCondition] =
    useState<TargetCondition>(testTargetCondition);

  const handleConditionChange = (condition: TargetCondition) =>
    setCondition(condition);

  console.log(">>> NEW RENDER >>>");

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
      <TargetConditionRender
        condition={condition}
        onChange={handleConditionChange}
        className="w-[1200px]"
      />
    </div>
  );
}
