import { cn } from "@ctrlplane/ui";

const getPercentChange = (current: number, previous: number) => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

export const PercentChange: React.FC<{
  current: number;
  previous: number;
}> = ({ current, previous }) => {
  const percentChange = getPercentChange(current, previous);

  return (
    <div
      className={cn(
        "mt-1 flex items-center text-xs",
        percentChange === 0 && "text-neutral-400",
        percentChange > 0 && "text-green-400",
        percentChange < 0 && "text-red-400",
      )}
    >
      <span>
        {percentChange === 0 && "-"}
        {percentChange > 0 && "↑"}
        {percentChange < 0 && "↓"} {Number(percentChange).toFixed(0)}% from
        previous period
      </span>
    </div>
  );
};
