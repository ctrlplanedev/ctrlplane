import { Badge } from "@ctrlplane/ui/badge";

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusLower = status.toLowerCase();
  if (statusLower === "success")
    return (
      <Badge
        variant="outline"
        className="border-green-500/30 bg-green-500/10 text-green-400"
      >
        Success
      </Badge>
    );
  if (statusLower === "running")
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-400"
      >
        Running
      </Badge>
    );
  if (statusLower === "deploying")
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-400"
      >
        Deploying
      </Badge>
    );
  if (statusLower === "pending")
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-400"
      >
        Pending
      </Badge>
    );
  if (statusLower === "failed")
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-400"
      >
        Failed
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
    >
      {status}
    </Badge>
  );
};
