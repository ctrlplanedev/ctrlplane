package releasemanager

import (
	"context"
	"fmt"

	"sync"
	"time"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/types/known/structpb"
)

var tracer = otel.Tracer("workspace/releasemanager")

func (m *Manager) EvaluateChange(ctx context.Context, changes *SyncResult) cmap.ConcurrentMap[string, *pb.Job] {
	jobs := cmap.New[*pb.Job]()
	var wg sync.WaitGroup

	for _, change := range changes.Changes.Added {
		wg.Add(1)
		go func(target *pb.ReleaseTarget) {
			defer wg.Done()
			_, job, err := m.Evaluate(ctx, target)
			if err != nil {
				log.Warn("error evaluating added change", "error", err.Error())
				return
			}
			if job != nil {
				jobs.Set(job.Id, job)
			}
		}(change.NewTarget)
	}

	for _, change := range changes.Changes.Updated {
		wg.Add(1)
		go func(target *pb.ReleaseTarget) {
			defer wg.Done()
			_, job, err := m.Evaluate(ctx, target)
			if err != nil {
				log.Warn("error evaluating updated change", "error", err.Error())
				return
			}
			if job != nil {
				jobs.Set(job.Id, job)
			}
		}(change.NewTarget)
	}

	for _, change := range changes.Changes.Removed {
		wg.Add(1)
		go func(target *pb.ReleaseTarget) {
			defer wg.Done()
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(target) {
				if job != nil {
					job.Status = pb.JobStatus_JOB_STATUS_CANCELLED
					job.UpdatedAt = time.Now().Format(time.RFC3339)
					jobs.Set(job.Id, job)
				}
			}
		}(change.OldTarget)
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

	m.store.Releases.Upsert(ctx, release)

	// Only deploy release if the most recent job is not for this given release

	// Check for the most recent job for this release target
	latestJob, _ := m.store.Jobs.MostRecentForReleaseTarget(ctx, releaseTarget)
	if latestJob != nil && latestJob.ReleaseId == release.ID() {
		return nil, nil, fmt.Errorf("most recent job is already for this release")
	}

	// If it can be released, dispatch the release
	job, err := m.NewJob(ctx, release)
	if err != nil {
		span.RecordError(err)
		return nil, nil, err
	}

	go m.IntegrationDispatch(ctx, job)

	return release, job, nil
}

func mustNewStructFromMap(m map[string]any) *structpb.Struct {
	s, err := structpb.NewStruct(m)
	if err != nil {
		panic(fmt.Sprintf("failed to create struct: %v", err))
	}
	return s
}

func DeepMerge(dst, src map[string]any) {
	for k, v := range src {
		if sm, ok := v.(map[string]any); ok {
			if dm, ok := dst[k].(map[string]any); ok {
				DeepMerge(dm, sm)
				continue
			}
		}
		dst[k] = v // overwrite
	}
}

func (m *Manager) NewJob(ctx context.Context, release *pb.Release) (*pb.Job, error) {
	// Create a new job for the given release and add it to the repository

	// Prepare job fields from the release
	releaseTarget := release.GetReleaseTarget()

	deployment, ok := m.store.Deployments.Get(releaseTarget.GetDeploymentId())
	if !ok {
		return nil, fmt.Errorf("deployment not found")
	}

	jobAgentId := deployment.GetJobAgentId()
	if jobAgentId == "" {
		return nil, fmt.Errorf("deployment has no job agent")
	}

	jobAgent, ok := m.store.JobAgents.Get(jobAgentId)
	if !ok {
		return nil, fmt.Errorf("job agent not found")
	}

	jobAgentConfig := jobAgent.GetConfig().AsMap()
	jobAgentDeploymentConfig := deployment.GetJobAgentConfig().AsMap()

	config := make(map[string]any)
	DeepMerge(config, jobAgentDeploymentConfig)
	DeepMerge(config, jobAgentConfig)

	job := &pb.Job{
		Id:             uuid.New().String(),
		ReleaseId:      release.ID(),
		JobAgentId:     jobAgentId,
		JobAgentConfig: mustNewStructFromMap(config),
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

func (m *Manager) IntegrationDispatch(ctx context.Context, job *pb.Job) {

}
