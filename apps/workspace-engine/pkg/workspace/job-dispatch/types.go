package jobdispatch

type JobAgentType string

const (
	JobAgentTypeTest   JobAgentType = "test-job-agent"
	JobAgentTypeGithub JobAgentType = "github-app"
)
