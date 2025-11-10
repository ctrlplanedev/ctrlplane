package jobdispatch

type JobAgentType string

const (
	JobAgentTypeGithub JobAgentType = "github-app"
	JobAgentTypeArgoCD JobAgentType = "argo-cd"
)
