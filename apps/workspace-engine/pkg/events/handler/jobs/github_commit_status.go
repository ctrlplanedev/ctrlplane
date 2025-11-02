package jobs

import (
	"context"
	"fmt"
	"workspace-engine/pkg/githubclient"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/google/go-github/v66/github"
)

func getGithubClient(ws *workspace.Workspace, owner string) (*github.Client, error) {
	var ghEntity *oapi.GithubEntity
	ghEntities := ws.GithubEntities().Items()
	for _, ghe := range ghEntities {
		if ghe.Slug == owner {
			ghEntity = ghe
		}
	}

	if ghEntity == nil {
		return nil, nil
	}

	client, err := githubclient.CreateGithubClient(ghEntity)
	if err != nil {
		return nil, err
	}

	return client, nil
}

// Can be one of: error, failure, pending, success
func getGithubStatus(status oapi.JobStatus) string {
	switch status {
	case oapi.ActionRequired:
		return "pending"
	case oapi.Cancelled:
		return "failure"
	case oapi.ExternalRunNotFound:
		return "error"
	case oapi.Failure:
		return "failure"
	case oapi.InProgress:
		return "pending"
	case oapi.InvalidJobAgent:
		return "failure"
	case oapi.InvalidIntegration:
		return "failure"
	case oapi.Skipped:
		return "pending"
	case oapi.Successful:
		return "success"
	default:
		return "error"
	}
}

func getTargetURL(owner, repo, sha string) string {
	return fmt.Sprintf("https://github.com/%s/%s/commit/%s", owner, repo, sha)
}

func MaybeAddCommitStatusFromJob(ws *workspace.Workspace, job *oapi.Job) error {
	ctx := context.Background()
	release, exists := ws.Releases().Get(job.ReleaseId)
	if !exists {
		return nil
	}

	owner, ok := release.Version.Metadata["github/owner"]
	if !ok {
		return nil
	}

	repo, ok := release.Version.Metadata["github/repo"]
	if !ok {
		return nil
	}

	sha, ok := release.Version.Metadata["git/sha"]
	if !ok {
		return nil
	}

	resource, ok := ws.Resources().Get(release.ReleaseTarget.ResourceId)
	if !ok {
		return nil
	}

	deployment, ok := ws.Deployments().Get(release.ReleaseTarget.DeploymentId)
	if !ok {
		return nil
	}

	environment, ok := ws.Environments().Get(release.ReleaseTarget.EnvironmentId)
	if !ok {
		return nil
	}

	client, err := getGithubClient(ws, owner)
	if err != nil {
		return err
	}

	if client == nil {
		return nil
	}

	_, _, err = client.Repositories.CreateStatus(ctx, owner, repo, sha, &github.RepoStatus{
		State:       github.String(getGithubStatus(job.Status)),
		TargetURL:   github.String(getTargetURL(owner, repo, sha)),
		Description: github.String(fmt.Sprintf("%s | %s | %s", deployment.Name, environment.Name, resource.Name)),
	})
	return err
}
