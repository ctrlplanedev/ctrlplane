import { cn } from "./index";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-400/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
