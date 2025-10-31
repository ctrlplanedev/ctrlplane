import { useState } from "react";

type CollapsibleDecisionProps = {
  Heading: ({
    isExpanded,
    onClick,
  }: {
    isExpanded: boolean;
    onClick: () => void;
  }) => React.ReactNode;
  Content: React.ReactNode;
};

export function CollapsibleDecision({
  Heading,
  Content,
}: CollapsibleDecisionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <Heading
        isExpanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
      />
      {isExpanded && Content}
    </div>
  );
}
