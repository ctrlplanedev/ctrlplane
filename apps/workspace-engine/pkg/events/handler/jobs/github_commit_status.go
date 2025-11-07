package jobs

import (
	"context"
	"fmt"
	"workspace-engine/pkg/githubclient"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/google/go-github/v66/github"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var ghTracer = otel.Tracer("GithubCommitStatus")

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
	ctx, span := ghTracer.Start(context.Background(), "MaybeAddCommitStatusFromJob")
	defer span.End()

	release, exists := ws.Releases().Get(job.ReleaseId)
	if !exists {
		return nil
	}

	span.SetAttributes(attribute.String("release.id", release.ID()))

	owner, ok := release.Version.Metadata["github/owner"]
	if !ok {
		return nil
	}
	span.SetAttributes(attribute.String("owner", owner))

	repo, ok := release.Version.Metadata["github/repo"]
	if !ok {
		return nil
	}
	span.SetAttributes(attribute.String("repo", repo))

	sha, ok := release.Version.Metadata["git/sha"]
	if !ok {
		return nil
	}
	span.SetAttributes(attribute.String("sha", sha))

	resource, ok := ws.Resources().Get(release.ReleaseTarget.ResourceId)
	if !ok {
		return nil
	}
	span.SetAttributes(attribute.String("resource.id", resource.Id))

	deployment, ok := ws.Deployments().Get(release.ReleaseTarget.DeploymentId)
	if !ok {
		return nil
	}
	span.SetAttributes(attribute.String("deployment.id", deployment.Id))

	environment, ok := ws.Environments().Get(release.ReleaseTarget.EnvironmentId)
	if !ok {
		return nil
	}
	span.SetAttributes(attribute.String("environment.id", environment.Id))

	client, err := getGithubClient(ws, owner)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get github client")
		return err
	}

	if client == nil {
		span.AddEvent("Github client not found", trace.WithAttributes(attribute.String("owner", owner), attribute.String("repo", repo), attribute.String("sha", sha)))
		return nil
	}

	_, _, err = client.Repositories.CreateStatus(ctx, owner, repo, sha, &github.RepoStatus{
		State:       github.String(getGithubStatus(job.Status)),
		TargetURL:   github.String(getTargetURL(owner, repo, sha)),
		Description: github.String(fmt.Sprintf("%s | %s | %s", deployment.Name, environment.Name, resource.Name)),
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create github status")
		return err
	}

	span.SetAttributes(attribute.String("status", getGithubStatus(job.Status)))
	span.SetAttributes(attribute.String("target_url", getTargetURL(owner, repo, sha)))
	span.SetAttributes(attribute.String("description", fmt.Sprintf("%s | %s | %s", deployment.Name, environment.Name, resource.Name)))
	span.AddEvent("Github status created", trace.WithAttributes(attribute.String("status", getGithubStatus(job.Status)), attribute.String("target_url", getTargetURL(owner, repo, sha)), attribute.String("description", fmt.Sprintf("%s | %s | %s", deployment.Name, environment.Name, resource.Name))))

	return nil
}
