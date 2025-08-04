package server

import (
	"github.com/ctrlplanedev/selector-engine/pkg/model"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
	"github.com/ctrlplanedev/selector-engine/pkg/model/selector"
	"io"

	"github.com/charmbracelet/log"
	"github.com/ctrlplanedev/selector-engine/pkg/engine"
	"github.com/ctrlplanedev/selector-engine/pkg/logger"
	"github.com/ctrlplanedev/selector-engine/pkg/mapping"

	pb "github.com/ctrlplanedev/selector-engine/pkg/pb/proto"

	"google.golang.org/grpc"
)

type SelectorEngineServer struct {
	pb.UnimplementedSelectorEngineServer
	logger *log.Logger
	engine model.Engine
}

// LoadResources implements bidirectional streaming for loading resources
func (s *SelectorEngineServer) LoadResources(stream grpc.BidiStreamingServer[pb.Resource, pb.Match]) error {
	//s.logger.Debug.Debug("LoadResources stream started")
	ctx := stream.Context()

	resourceChan := make(chan resource.Resource)

	matchChan, err := s.engine.LoadResource(ctx, resourceChan)
	if err != nil {
		return err
	}

	errChan := make(chan error, 2)

	go func() {
		defer close(resourceChan)
		for {
			res, err := stream.Recv()
			if err == io.EOF {
				return
			}
			if err != nil {
				errChan <- err
				return
			}

			//s.logger.Debug("Received resource", "name", res.GetName(), "id", res.GetId())
			modelReq := mapping.FromProtoResource(res)
			select {
			case resourceChan <- modelReq:
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		select {
		case match, ok := <-matchChan:
			if !ok {
				return nil
			}
			resp := mapping.ToProtoMatch(match)
			if err := stream.Send(resp); err != nil {
				s.logger.Error("Error sending match", "error", err)
				return err
			}
		case err := <-errChan:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// RemoveResources implements bidirectional streaming for removing resources
func (s *SelectorEngineServer) RemoveResources(stream grpc.BidiStreamingServer[pb.ResourceRef, pb.Status]) error {
	//s.logger.Debug("RemoveResources stream started")
	ctx := stream.Context()

	refChan := make(chan resource.ResourceRef)

	statusChan, err := s.engine.RemoveResource(ctx, refChan)
	if err != nil {
		return err
	}

	errChan := make(chan error, 2)

	go func() {
		defer close(refChan)
		for {
			pbRef, err := stream.Recv()
			if err == io.EOF {
				return
			}
			if err != nil {
				errChan <- err
				return
			}

			//s.logger.Debug("Received resource ref for removal", "id", pbRef.GetId())
			modelRef := mapping.FromProtoResourceRef(pbRef)
			select {
			case refChan <- modelRef:
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		select {
		case status, ok := <-statusChan:
			if !ok {
				return nil
			}
			if err := stream.Send(mapping.ToProtoStatus(status)); err != nil {
				s.logger.Error("Error sending status", "error", err)
				return err
			}
		case err := <-errChan:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// LoadSelectors implements bidirectional streaming for loading selectors
func (s *SelectorEngineServer) LoadSelectors(stream grpc.BidiStreamingServer[pb.ResourceSelector, pb.Match]) error {
	//s.logger.Debug("LoadSelectors stream started")
	ctx := stream.Context()

	selectorChan := make(chan selector.ResourceSelector)

	matchChan, err := s.engine.LoadSelector(ctx, selectorChan)
	if err != nil {
		return err
	}

	errChan := make(chan error, 2)

	go func() {
		defer close(selectorChan)
		for {
			sel, err := stream.Recv()
			if err == io.EOF {
				return
			}
			if err != nil {
				errChan <- err
				return
			}

			//s.logger.Debug("Received selector", "id", sel.GetId(), "entityType", sel.GetEntityType())
			modelReq, err := mapping.FromProtoResourceSelector(sel)
			if err != nil {
				errChan <- err
				return
			}
			select {
			case selectorChan <- modelReq:
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		select {
		case match, ok := <-matchChan:
			if !ok {
				return nil
			}
			if err := stream.Send(mapping.ToProtoMatch(match)); err != nil {
				s.logger.Error("Error sending match", "error", err)
				return err
			}
		case err := <-errChan:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// RemoveSelectors implements bidirectional streaming for removing selectors
func (s *SelectorEngineServer) RemoveSelectors(stream grpc.BidiStreamingServer[pb.ResourceSelectorRef, pb.Status]) error {
	//s.logger.Debug("RemoveSelectors stream started")
	ctx := stream.Context()

	refChan := make(chan selector.ResourceSelectorRef)

	statusChan, err := s.engine.RemoveSelector(ctx, refChan)
	if err != nil {
		return err
	}

	errChan := make(chan error, 2)

	go func() {
		defer close(refChan)
		for {
			pbRef, err := stream.Recv()
			if err == io.EOF {
				return
			}
			if err != nil {
				errChan <- err
				return
			}

			//s.logger.Debug("Received selector ref for removal", "id", pbRef.GetId())
			modelRef := mapping.FromProtoResourceSelectorRef(pbRef)
			select {
			case refChan <- modelRef:
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		select {
		case status, ok := <-statusChan:
			if !ok {
				return nil
			}
			if err := stream.Send(mapping.ToProtoStatus(status)); err != nil {
				s.logger.Error("Error sending status", "error", err)
				return err
			}
		case err := <-errChan:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// ServerConfig holds configuration for the server
type ServerConfig struct {
	MaxParallelCalls int
}

func NewServer() *grpc.Server {
	return NewServerWithConfig(&ServerConfig{MaxParallelCalls: engine.DefaultMaxParallelCalls})
}

func NewServerWithConfig(config *ServerConfig) *grpc.Server {
	log := logger.Get()

	var eng model.Engine
	if config == nil || config.MaxParallelCalls <= 0 {
		log.Fatal("MaxParallelCalls not set or invalid")
	} else {
		eng = engine.NewGoParallelDispatcherEngine(config.MaxParallelCalls)
	}

	s := grpc.NewServer()
	pb.RegisterSelectorEngineServer(s, &SelectorEngineServer{
		logger: log,
		engine: eng,
	})
	return s
}
