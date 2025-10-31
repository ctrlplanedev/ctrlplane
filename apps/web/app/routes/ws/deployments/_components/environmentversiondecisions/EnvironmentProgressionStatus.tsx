import { CheckCircle, Loader2, XCircle } from "lucide-react";

export function EnvironmentProgressionStatus({
  allowed,
  failure,
}: {
  allowed: boolean;
  failure: boolean;
}) {
  if (allowed) {
    return (
      <>
        <span className="text-xs">Environment progression complete</span>
        <div className="flex-grow" />
        <CheckCircle className="size-3.5 text-green-500" />
      </>
    );
  }

  if (failure) {
    return (
      <>
        <span className="text-xs">Environment progression failed</span>
        <div className="flex-grow" />
        <XCircle className="size-3.5 text-red-500" />
      </>
    );
  }

  return (
    <>
      <span className="text-xs">Environment progression in progress</span>
      <div className="flex-grow" />
      <Loader2 className="size-3.5 animate-spin text-blue-500" />
    </>
  );
}
