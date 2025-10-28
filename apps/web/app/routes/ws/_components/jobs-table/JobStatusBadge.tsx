const JobStatusDisplayName = {
  cancelled: "Cancelled",
  skipped: "Skipped",
  inProgress: "In Progress",
  actionRequired: "Action Required",
  pending: "Pending",
  failure: "Failure",
  invalidJobAgent: "Invalid Job Agent",
  invalidIntegration: "Invalid Integration",
  externalRunNotFound: "External Run Not Found",
  successful: "Successful",
};

// Basic job status badge component with color mapping

const JobStatusBadgeColor: Record<string, string> = {
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  skipped: "bg-gray-100 text-gray-700 border-gray-200",
  inProgress: "bg-blue-100 text-blue-800 border-blue-200",
  actionRequired: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pending: "bg-muted text-muted-foreground border-muted-foreground/20",
  failure: "bg-red-100 text-red-800 border-red-200",
  invalidJobAgent: "bg-orange-100 text-orange-800 border-orange-200",
  invalidIntegration: "bg-orange-100 text-orange-800 border-orange-200",
  externalRunNotFound: "bg-orange-100 text-orange-800 border-orange-200",
  successful: "bg-green-100 text-green-800 border-green-200",
};

export function JobStatusBadge({
  status,
}: {
  status: keyof typeof JobStatusDisplayName;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${JobStatusBadgeColor[status] ?? "border-gray-200 bg-gray-100 text-gray-700"}`}
    >
      {JobStatusDisplayName[status]}
    </span>
  );
}
