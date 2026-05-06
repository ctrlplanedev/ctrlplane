package desiredrelease

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"iter"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/singleflight"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/policyeval"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

var getterTracer = otel.Tracer("workspace-engine/desiredrelease/getter")

type policiesGetter = policyeval.Getter
type variableResolverGetter = variableresolver.Getter

// candidateVersionBatchSize controls how many deployable versions are fetched
// per keyset-paginated round trip. Most release targets find an eligible
// version in the first few rows; this size only matters when policies block
// the entire newest batch.
const candidateVersionBatchSize = 500

var _ Getter = (*PostgresGetter)(nil)

func NewPostgresGetter(
	queries *db.Queries,
	rtForDep releasetargets.GetReleaseTargetsForDeployment,
	rtForDepEnv releasetargets.GetReleaseTargetsForDeploymentAndEnvironment,
	policiesForRT policies.GetPoliciesForReleaseTarget,
	jobsForRT releasetargets.GetJobsForReleaseTarget,
) *PostgresGetter {
	return &PostgresGetter{
		policiesGetter: policyeval.NewPostgresGetter(
			queries,
			rtForDep,
			rtForDepEnv,
			policiesForRT,
			jobsForRT,
		),
		variableResolverGetter: variableresolver.NewPostgresGetter(queries),
	}
}

type PostgresGetter struct {
	policiesGetter
	variableResolverGetter

	// firstBatchSF deduplicates the first-batch fetch when many release
	// targets for the same deployment reconcile concurrently — typical
	// after a workspace-wide policy update. Only the first batch is shared:
	// it's an immutable slice, safe across goroutines, and the 99% case
	// (a deployable version exists in the newest 500 rows) terminates here
	// without ever issuing a second query. Consumers that need to walk
	// further paginate independently from their own cursor.
	firstBatchSF singleflight.Group
}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetReleaseTargetScope(
	ctx context.Context,
	rt *ReleaseTarget,
) (*evaluator.EvaluatorScope, error) {
	q := db.GetQueries(ctx)

	depRow, err := q.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", rt.DeploymentID, err)
	}

	envRow, err := q.GetEnvironmentByID(ctx, rt.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", rt.EnvironmentID, err)
	}

	resRow, err := q.GetResourceByID(ctx, rt.ResourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource %s: %w", rt.ResourceID, err)
	}

	return &evaluator.EvaluatorScope{
		Deployment:  db.ToOapiDeployment(depRow),
		Environment: db.ToOapiEnvironment(envRow),
		Resource:    db.ToOapiResource(resRow),
	}, nil
}

// candidateVersionColumns is the column list for SELECT against
// deployment_version, kept consistent with the sqlc-generated
// ListDeployableVersionsByDeploymentIDAfter query so we can scan rows into
// db.DeploymentVersion using the same field order.
const candidateVersionColumns = `id, name, tag, config, job_agent_config, deployment_id, metadata, status, message, created_at, workspace_id`

// IterCandidateVersions yields deployable versions newest-first, fetching them
// in batches via keyset pagination. The previous implementation buffered up to
// 500 versions up front, which silently skipped reconciliation for any release
// target whose desired version sat beyond that window. With early-exit in the
// consumer, this iterator usually stops after the first few rows; only when
// every recent version is blocked by policy does it walk further history.
//
// The first batch is deduplicated via singleflight so a burst of concurrent
// reconciles for release targets sharing a deployment collapses to one DB
// round trip. The singleflight key includes a hash of pushdownClauses so
// consumers applying different pushdown filters do not share results.
// Subsequent batches (consumed only when the first 500 rows are exhausted
// without finding an eligible version) are fetched independently.
//
// pushdownClauses are SQL WHERE fragments emitted by celutil.SQLExtractor
// with `$N` placeholders that resolve against pushdownArgs starting at $5
// ($1-$4 are reserved for deploymentID, limit, afterCreatedAt, afterID).
// All values are passed as real query parameters — never inlined — so SQL
// injection is structurally prevented.
func (g *PostgresGetter) IterCandidateVersions(
	ctx context.Context,
	deploymentID uuid.UUID,
	pushdownClauses []string,
	pushdownArgs []any,
) iter.Seq2[*oapi.DeploymentVersion, error] {
	return func(yield func(*oapi.DeploymentVersion, error) bool) {
		firstBatch, err := g.fetchFirstBatch(ctx, deploymentID, pushdownClauses, pushdownArgs)
		if err != nil {
			yield(nil, err)
			return
		}
		if len(firstBatch) == 0 {
			return
		}

		for _, row := range firstBatch {
			if !yield(db.ToOapiDeploymentVersion(row), nil) {
				return
			}
		}

		if len(firstBatch) < candidateVersionBatchSize {
			return
		}

		last := firstBatch[len(firstBatch)-1]
		afterCreatedAt := last.CreatedAt
		afterID := last.ID

		for {
			rows, err := queryCandidateVersionsBatch(
				ctx, deploymentID, pushdownClauses, pushdownArgs, afterCreatedAt, afterID,
			)
			if err != nil {
				yield(nil, err)
				return
			}
			if len(rows) == 0 {
				return
			}

			for _, row := range rows {
				if !yield(db.ToOapiDeploymentVersion(row), nil) {
					return
				}
			}

			if len(rows) < candidateVersionBatchSize {
				return
			}

			last := rows[len(rows)-1]
			afterCreatedAt = last.CreatedAt
			afterID = last.ID
		}
	}
}

// fetchFirstBatch loads the newest candidateVersionBatchSize deployable
// versions for a deployment, sharing the result across concurrent callers via
// singleflight keyed by (deploymentID, hash(pushdownClauses)). Same selector
// text always produces the same args, so hashing only the clauses is enough
// to discriminate cache slots. The returned slice is immutable.
func (g *PostgresGetter) fetchFirstBatch(
	ctx context.Context,
	deploymentID uuid.UUID,
	pushdownClauses []string,
	pushdownArgs []any,
) ([]db.DeploymentVersion, error) {
	key := deploymentID.String() + "|" + hashClauses(pushdownClauses)
	// Detach the singleflight closure from the first caller's cancellation
	// so one caller's ctx cancellation doesn't fail the shared query for
	// every other waiter on the same key. Trace context is preserved.
	qCtx := context.WithoutCancel(ctx)
	v, err, _ := g.firstBatchSF.Do(key, func() (any, error) {
		return queryCandidateVersionsBatch(
			qCtx, deploymentID, pushdownClauses, pushdownArgs, pgtype.Timestamptz{}, uuid.Nil,
		)
	})
	if err != nil {
		return nil, err
	}
	return v.([]db.DeploymentVersion), nil
}

// queryCandidateVersionsBatch executes a keyset-paginated SELECT against
// deployment_version with optional pushdown WHERE fragments. It bypasses the
// sqlc-generated query because sqlc cannot template-in dynamic predicates;
// the column list and base WHERE are kept structurally identical to
// ListDeployableVersionsByDeploymentIDAfter so future schema changes flow
// through both paths in lockstep.
//
// The pushdown clauses use $N placeholders starting at $5; pushdownArgs are
// appended to the base [$1=deploymentID, $2=limit, $3=afterCreatedAt,
// $4=afterID] argument list in the same order.
func queryCandidateVersionsBatch(
	ctx context.Context,
	deploymentID uuid.UUID,
	pushdownClauses []string,
	pushdownArgs []any,
	afterCreatedAt pgtype.Timestamptz,
	afterID uuid.UUID,
) ([]db.DeploymentVersion, error) {
	ctx, span := getterTracer.Start(ctx, "queryCandidateVersionsBatch")
	defer span.End()

	pushdownCount := 0
	for _, c := range pushdownClauses {
		if c != "" {
			pushdownCount++
		}
	}

	var b strings.Builder
	b.WriteString("SELECT ")
	b.WriteString(candidateVersionColumns)
	b.WriteString(` FROM deployment_version
WHERE deployment_id = $1
  AND status NOT IN ('rejected', 'building')
  AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::uuid))`)
	for _, frag := range pushdownClauses {
		if frag == "" {
			continue
		}
		b.WriteString("\n  AND (")
		b.WriteString(frag)
		b.WriteString(")")
	}
	b.WriteString("\nORDER BY created_at DESC, id DESC\nLIMIT $2")

	args := make([]any, 0, 4+len(pushdownArgs))
	args = append(args,
		deploymentID,
		int64(candidateVersionBatchSize),
		afterCreatedAt,
		afterID,
	)
	args = append(args, pushdownArgs...)

	rows, err := db.GetPool(ctx).Query(ctx, b.String(), args...)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("list versions for deployment %s: %w", deploymentID, err)
	}
	defer rows.Close()

	var out []db.DeploymentVersion
	for rows.Next() {
		var v db.DeploymentVersion
		if err := rows.Scan(
			&v.ID, &v.Name, &v.Tag, &v.Config, &v.JobAgentConfig, &v.DeploymentID,
			&v.Metadata, &v.Status, &v.Message, &v.CreatedAt, &v.WorkspaceID,
		); err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("scan deployment_version: %w", err)
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(
		attribute.String("deployment.id", deploymentID.String()),
		attribute.Bool("pushdown.applied", pushdownCount > 0),
		attribute.Int("pushdown.clauses_count", pushdownCount),
		attribute.Bool("cursor.paginated", afterCreatedAt.Valid),
		attribute.Int("rows.returned", len(out)),
		attribute.Int("rows.limit", candidateVersionBatchSize),
		attribute.Bool("rows.below_limit", len(out) < candidateVersionBatchSize),
	)

	return out, nil
}

// hashClauses produces a stable cache-key suffix for a set of pushdown
// clauses. Order matters — callers should pass clauses in canonical order
// if they want different orderings to share a cache slot.
func hashClauses(clauses []string) string {
	if len(clauses) == 0 {
		return ""
	}
	h := sha256.New()
	for _, c := range clauses {
		h.Write([]byte(c))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

func (g *PostgresGetter) GetApprovalRecords(
	ctx context.Context,
	versionID, environmentID string,
) ([]*oapi.UserApprovalRecord, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	approvalRecords, err := db.GetQueries(ctx).
		ListApprovedRecordsByVersionAndEnvironment(ctx, db.ListApprovedRecordsByVersionAndEnvironmentParams{
			VersionID:     versionIDUUID,
			EnvironmentID: environmentIDUUID,
		})
	if err != nil {
		return nil, fmt.Errorf("list approval records for workspace %s: %w", versionID, err)
	}
	approvalRecordsOAPI := make([]*oapi.UserApprovalRecord, 0, len(approvalRecords))
	for _, approvalRecord := range approvalRecords {
		approvalRecordsOAPI = append(
			approvalRecordsOAPI,
			db.ToOapiUserApprovalRecord(approvalRecord),
		)
	}
	return approvalRecordsOAPI, nil
}

func (g *PostgresGetter) GetPolicySkips(
	ctx context.Context,
	versionID, environmentID, resourceID string,
) ([]*oapi.PolicySkip, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	resourceIDUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	policySkips, err := db.GetQueries(ctx).
		ListPolicySkipsForTarget(ctx, db.ListPolicySkipsForTargetParams{
			VersionID:     versionIDUUID,
			EnvironmentID: environmentIDUUID,
			ResourceID:    resourceIDUUID,
		})
	if err != nil {
		return nil, fmt.Errorf("list policy skips for version %s: %w", versionID, err)
	}
	result := make([]*oapi.PolicySkip, 0, len(policySkips))
	for _, skip := range policySkips {
		result = append(result, db.ToOapiPolicySkip(skip))
	}
	return result, nil
}
