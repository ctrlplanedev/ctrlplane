export enum JobAgentType {
  KubernetesJob = "kubernetes-job",
  GithubApp = "github-app",
  ExecWindows = "exec-windows",
  ExecLinux = "exec-linux",
  Jenkins = "jenkins"
}

export const JobAgentTypeDisplayNames: Record<JobAgentType, string> = {
  [JobAgentType.KubernetesJob]: "Kubernetes Job",
  [JobAgentType.GithubApp]: "Github App",
  [JobAgentType.ExecWindows]: "PowerShell",
  [JobAgentType.ExecLinux]: "Shell",
  [JobAgentType.Jenkins]: "Jenkins",
};
