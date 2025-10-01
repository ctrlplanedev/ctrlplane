package releasetarget

import (
	"workspace-engine/pkg/pb"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Server struct {
	pb.UnimplementedReleaseTargetServiceServer
}

var tracer = otel.Tracer("server/releasetarget")

func New() *Server {
	return &Server{}
}

func (s *Server) Compute(
	req *pb.ComputeReleaseTargetsRequest,
	stream pb.ReleaseTargetService_ComputeServer,
) error {
	ctx := stream.Context()
	ctx, span := tracer.Start(ctx, "Compute",
		trace.WithAttributes(
			attribute.Int("request.environments", len(req.Environments)),
			attribute.Int("request.deployments", len(req.Deployments)),
			attribute.Int("request.resources", len(req.Resources)),
		))
	defer span.End()

	targetsChan, err := NewComputation(ctx, req).
		FilterEnvironmentResources().
		FilterDeploymentResources().
		Stream()
	
	if err != nil {
		span.RecordError(err)
		return err
	}

	// Stream all targets to the client
	targetsStreamed := 0
	for target := range targetsChan {
		if err := stream.Send(target); err != nil {
			span.RecordError(err)
			return status.Errorf(codes.Internal, "failed to send release target: %v", err)
		}
		targetsStreamed++
	}

	span.SetAttributes(attribute.Int("targets.streamed", targetsStreamed))
	return nil
}
