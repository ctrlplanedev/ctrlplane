import { cn } from "@ctrlplane/ui";

export const Feature = ({
  title,
  description,
  icon,
  index,
  color = "red",
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
  color?:
    | "red"
    | "amber"
    | "emerald"
    | "cyan"
    | "blue"
    | "violet"
    | "fuchsia"
    | "lime";
}) => {
  return (
    <div
      className={cn(
        "group/feature relative flex  flex-col py-10 dark:border-neutral-800 lg:border-r",
        (index === 0 || index === 4) && "dark:border-neutral-800 lg:border-l",
        index < 4 && "dark:border-neutral-800 lg:border-b",
      )}
    >
      {index < 4 && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100 dark:from-neutral-900",
            color === "amber" && "dark:from-amber-500/5",
            color === "red" && "dark:from-red-500/5",
            color === "emerald" && "dark:from-emerald-500/5",
            color === "cyan" && "dark:from-cyan-500/5",
            color === "blue" && "dark:from-blue-500/5",
            color === "violet" && "dark:from-violet-500/5",
            color === "fuchsia" && "dark:from-fuchsia-500/5",
            color === "lime" && "dark:from-lime-500/5",
          )}
        />
      )}
      {index >= 4 && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100",
            color === "amber" && "dark:from-amber-500/5",
            color === "red" && "dark:from-red-500/5",
            color === "emerald" && "dark:from-emerald-500/5",
            color === "cyan" && "dark:from-cyan-500/5",
            color === "blue" && "dark:from-blue-500/5",
            color === "violet" && "dark:from-violet-500/5",
            color === "fuchsia" && "dark:from-fuchsia-500/5",
            color === "lime" && "dark:from-lime-500/5",
          )}
        />
      )}
      <div className="relative z-10 mb-4 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="relative z-10 mb-2 px-10 text-lg font-bold">
        <div
          className={cn(
            "absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-br-full rounded-tr-full bg-neutral-300 transition-all duration-200 group-hover/feature:h-8 dark:bg-neutral-700",
            color === "amber" && "group-hover/feature:bg-amber-500",
            color === "red" && "group-hover/feature:bg-red-500",
            color === "emerald" && "group-hover/feature:bg-emerald-500",
            color === "cyan" && "group-hover/feature:bg-cyan-500",
            color === "blue" && "group-hover/feature:bg-blue-500",
            color === "violet" && "group-hover/feature:bg-violet-500",
            color === "fuchsia" && "group-hover/feature:bg-fuchsia-500",
            color === "lime" && "group-hover/feature:bg-lime-500",
          )}
        />
        <span className="inline-block text-neutral-800 transition duration-200 group-hover/feature:translate-x-2 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="relative z-10 max-w-xs px-10 text-sm text-neutral-600 dark:text-neutral-300">
        {description}
      </p>
    </div>
  );
};
