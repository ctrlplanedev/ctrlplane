import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  XCircle,
} from "lucide-react";

import type { DeploymentVersionStatus, JobStatus } from "./types";

export const getVersionStatusColor = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return "text-green-600 border-green-500/20";
    case "building":
      return "text-blue-600 border-blue-500/20";
    case "failed":
      return "text-red-600 border-red-500/20";
    case "rejected":
      return "text-amber-600 border-amber-500/20";
    default:
      return "text-neutral-600 border-neutral-500/20";
  }
};

export const getVersionStatusIcon = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="h-4 w-4" />;
    case "building":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4" />;
    case "rejected":
      return <Pause className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

export const getJobStatusColor = (status: JobStatus) => {
  switch (status) {
    case "successful":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "inProgress":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "failure":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "cancelled":
      return "bg-neutral-500/10 text-neutral-600 border-neutral-500/20";
    default:
      return "bg-neutral-500/10 text-neutral-600 border-neutral-500/20";
  }
};

export const getJobStatusIcon = (status: JobStatus) => {
  switch (status) {
    case "successful":
      return <CheckCircle2 className="h-4 w-4" />;
    case "inProgress":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "failure":
      return <XCircle className="h-4 w-4" />;
    case "pending":
      return <Clock className="h-4 w-4" />;
    case "cancelled":
      return <Pause className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};
