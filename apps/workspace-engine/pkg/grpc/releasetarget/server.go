package releasetarget

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/pb/pbconnect"

	"connectrpc.com/connect"
	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type Server struct {
	pbconnect.UnimplementedReleaseTargetServiceHandler
}

var tracer = otel.Tracer("server/releasetarget")

func New() *Server {
	return &Server{}
}

func (s *Server) Compute(
	ctx context.Context,
	req *connect.Request[pb.ComputeReleaseTargetsRequest],
) (*connect.Response[pb.ComputeReleaseTargetsResponse], error) {
	ctx, span := tracer.Start(ctx, "Compute",
		trace.WithAttributes(
			attribute.Int("request.environments", len(req.Msg.Environments)),
			attribute.Int("request.deployments", len(req.Msg.Deployments)),
			attribute.Int("request.resources", len(req.Msg.Resources)),
		))
	defer span.End()

	log.Info("Compute request", "environments", len(req.Msg.Environments), "deployments", len(req.Msg.Deployments), "resources", len(req.Msg.Resources))

	targets, err := NewComputation(ctx, req.Msg).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Generate()

	if err != nil {
		span.RecordError(err)
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	span.SetAttributes(attribute.Int("targets.generated", len(targets)))
	return &connect.Response[pb.ComputeReleaseTargetsResponse]{
		Msg: &pb.ComputeReleaseTargetsResponse{
			ReleaseTargets: targets,
		},
	}, nil
}
