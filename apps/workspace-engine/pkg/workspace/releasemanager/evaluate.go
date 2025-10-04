package releasemanager

import (
	"context"
	"sync"
	"time"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager")

func (m *Manager) EvaluateChange(ctx context.Context, changes *SyncResult) cmap.ConcurrentMap[string, *pb.Job] {
	jobs := cmap.New[*pb.Job]()
	var wg sync.WaitGroup


	for _, change := range changes.Changes.Added {
		wg.Add(1)
		go func(target *pb.ReleaseTarget) {
			defer wg.Done()
			_, job, _ := m.Evaluate(ctx, target)
			if job != nil {
				jobs.Set(job.Id, job)
			}
		}(change.NewTarget)
	}

	for _, change := range changes.Changes.Updated {
		wg.Add(1)
		go func(target *pb.ReleaseTarget) {
			defer wg.Done()
			_, job, _ := m.Evaluate(ctx, target)
			if job != nil {
				jobs.Set(job.Id, job)
			}
		}(change.NewTarget)
	}

	wg.Wait()

	return jobs
}

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*pb.Release, *pb.Job, error) {
	ctx, span := tracer.Start(ctx, "Evaluate",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	version, err := m.versionManager.SelectDeployableVersion(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, nil, err
	}

	variables, err := m.variableManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, nil, err
	}

	span.SetAttributes(
		attribute.Int("variables.count", len(variables)),
		attribute.String("version.id", version.Id),
		attribute.String("version.tag", version.Tag),
	)

	// Clone variables to avoid parent changes affecting this release
	clonedVariables := make(map[string]*pb.VariableValue, len(variables))
	for k, v := range variables {
		// Deep copy VariableValue (shallow copy is sufficient if VariableValue is immutable)
		if v != nil {
			// Assuming VariableValue is a proto.Message, use proto.Clone if available
			clonedVariables[k] = v.ProtoReflect().Interface().(*pb.VariableValue)
		} else {
			clonedVariables[k] = nil
		}
	}

	release := &pb.Release{
		ReleaseTarget:      releaseTarget,
		Version:            version,
		Variables:          clonedVariables,
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}

	// Only deploy release if the most recent job is not for this given release

	// Check for the most recent job for this release target
	latestJob, _ := m.store.Jobs.MostRecentForReleaseTarget(ctx, releaseTarget)
	if latestJob != nil && latestJob.ReleaseId == release.ID() {
		// The most recent job is already for this release, do not deploy again
		return nil, nil, nil
	}

	// If it can be released, dispatch the release
	job, err := m.NewJob(ctx, release)
	if err != nil {
		span.RecordError(err)
		return nil, nil, err
	}

	go m.Dispatch(ctx, release)

	return release, job,  nil
}

func (m *Manager) NewJob(ctx context.Context, release *pb.Release) (*pb.Job, error) {
	// Create a new job for the given release and add it to the repository

	// Prepare job fields from the release
	releaseTarget := release.GetReleaseTarget()
	version := release.GetVersion()

	job := &pb.Job{
		ReleaseId:      release.ID(),
		// JobAgentId:     version.GetJobAgentId(),
		JobAgentConfig: version.GetJobAgentConfig(),
		Status:         pb.JobStatus_JOB_STATUS_PENDING,
		ResourceId:     releaseTarget.GetResourceId(),
		EnvironmentId:  releaseTarget.GetEnvironmentId(),
		DeploymentId:   releaseTarget.GetDeploymentId(),
		CreatedAt:      time.Now().Format(time.RFC3339),
		UpdatedAt:      time.Now().Format(time.RFC3339),
	}

	m.store.Jobs.Upsert(ctx, job)

	return job, nil
}

func (m *Manager) Dispatch(ctx context.Context, release *pb.Release) {
	
}
