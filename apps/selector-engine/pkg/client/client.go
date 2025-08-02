package client

import (
	"context"
	"io"
	"math/rand"
	"os"
	"sync"

	"github.com/charmbracelet/log"
	pb "github.com/ctrlplanedev/selector-engine/pkg/pb/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	// MaxBatchSize defines the maximum number of items to send in a single stream
	MaxBatchSize = 1000
)

type SelectorEngineClient struct {
	conn   *grpc.ClientConn
	client pb.SelectorEngineClient
	logger *log.Logger
}

func NewClient(address string) (*SelectorEngineClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := pb.NewSelectorEngineClient(conn)

	return &SelectorEngineClient{
		conn:   conn,
		client: client,
		logger: log.NewWithOptions(os.Stderr, log.Options{ReportTimestamp: true}),
	}, nil
}

func (c *SelectorEngineClient) Close() error {
	return c.conn.Close()
}

// LoadResources starts a bidirectional streaming call to load resources
func (c *SelectorEngineClient) LoadResources(ctx context.Context) (grpc.BidiStreamingClient[pb.Resource, pb.Match], error) {
	return c.client.LoadResources(ctx)
}

// LoadResourcesBatch loads resources in batches of up to MaxBatchSize
func (c *SelectorEngineClient) LoadResourcesBatch(ctx context.Context, resources []*pb.Resource) ([]*pb.Match, error) {
	var allMatches []*pb.Match
	var mu sync.Mutex

	for i := 0; i < len(resources); i += MaxBatchSize {
		end := i + MaxBatchSize
		if end > len(resources) {
			end = len(resources)
		}
		c.logger.Info("Next LoadResources batch", "startIndex", i, "endIndex", end)
		batch := resources[i:end]

		stream, err := c.client.LoadResources(ctx)
		if err != nil {
			return nil, err
		}

		errChan := make(chan error, 1)
		doneChan := make(chan bool, 1)

		go func() {
			batchMatchCount := 0
			for {
				match, err := stream.Recv()
				if err == io.EOF {
					doneChan <- true
					c.logger.Info("LoadResources batch done", "batch match count", batchMatchCount)
					return
				}
				if err != nil {
					errChan <- err
					c.logger.Error("LoadResources batch error", "error", err)
					return
				}
				mu.Lock()
				batchMatchCount++
				allMatches = append(allMatches, match)
				mu.Unlock()
				c.logger.Debug("Received match", "message", match.GetMessage(), "resourceId", match.GetResourceId())
			}
		}()

		for _, resource := range batch {
			if err := stream.Send(resource); err != nil {
				return nil, err
			}
			c.logger.Debug("Sent resource", "name", resource.GetName(), "id", resource.GetId())
		}

		if err := stream.CloseSend(); err != nil {
			return nil, err
		}

		select {
		case err := <-errChan:
			return nil, err
		case <-doneChan:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return allMatches, nil
}

// RemoveResources starts a bidirectional streaming call to remove resources
func (c *SelectorEngineClient) RemoveResources(ctx context.Context) (grpc.BidiStreamingClient[pb.ResourceRef, pb.Status], error) {
	return c.client.RemoveResources(ctx)
}

// RemoveResourcesBatch removes resources in batches of up to MaxBatchSize
func (c *SelectorEngineClient) RemoveResourcesBatch(ctx context.Context, resourceRefs []*pb.ResourceRef) ([]*pb.Status, error) {
	var allStatuses []*pb.Status
	var mu sync.Mutex

	for i := 0; i < len(resourceRefs); i += MaxBatchSize {
		end := i + MaxBatchSize
		if end > len(resourceRefs) {
			end = len(resourceRefs)
		}
		c.logger.Info("Next RemoveResources batch", "startIndex", i, "endIndex", end)
		batch := resourceRefs[i:end]

		stream, err := c.client.RemoveResources(ctx)
		if err != nil {
			return nil, err
		}

		errChan := make(chan error, 1)
		doneChan := make(chan bool, 1)

		go func() {
			statusErrCount := 0
			for {
				status, err := stream.Recv()
				if err == io.EOF {
					doneChan <- true
					c.logger.Info("RemoveResources batch done", "status error count", statusErrCount)
					return
				}
				if err != nil {
					errChan <- err
					c.logger.Error("RemoveResources batch error", "error", err)
					return
				}
				mu.Lock()
				if status.GetError() {
					statusErrCount++
				}
				allStatuses = append(allStatuses, status)
				mu.Unlock()
				c.logger.Debug("Received status", "error", status.GetError(), "message", status.GetMessage())
			}
		}()

		for _, ref := range batch {
			if err := stream.Send(ref); err != nil {
				return nil, err
			}
			c.logger.Debug("Sent resource ref for removal", "id", ref.GetId())
		}

		if err := stream.CloseSend(); err != nil {
			return nil, err
		}

		select {
		case err := <-errChan:
			return nil, err
		case <-doneChan:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return allStatuses, nil
}

// LoadSelectors starts a bidirectional streaming call to load selectors
func (c *SelectorEngineClient) LoadSelectors(ctx context.Context) (grpc.BidiStreamingClient[pb.ResourceSelector, pb.Match], error) {
	return c.client.LoadSelectors(ctx)
}

// LoadSelectorsBatch loads selectors in batches of up to MaxBatchSize
func (c *SelectorEngineClient) LoadSelectorsBatch(ctx context.Context, selectors []*pb.ResourceSelector) ([]*pb.Match, error) {
	var allMatches []*pb.Match
	var mu sync.Mutex

	for i := 0; i < len(selectors); i += MaxBatchSize {
		end := i + MaxBatchSize
		if end > len(selectors) {
			end = len(selectors)
		}
		c.logger.Info("Next LoadSelectors batch", "startIndex", i, "endIndex", end)
		batch := selectors[i:end]

		stream, err := c.client.LoadSelectors(ctx)
		if err != nil {
			return nil, err
		}

		errChan := make(chan error, 1)
		doneChan := make(chan bool, 1)

		go func() {
			batchMatchCount := 0
			for {
				match, err := stream.Recv()
				if err == io.EOF {
					doneChan <- true
					c.logger.Info("LoadSelectors batch done", "batch match count", batchMatchCount)
					return
				}
				if err != nil {
					errChan <- err
					c.logger.Error("LoadSelectors batch error", "error", err)
					return
				}
				mu.Lock()
				batchMatchCount++
				allMatches = append(allMatches, match)
				mu.Unlock()
				c.logger.Debug("Received match", "message", match.GetMessage(), "selectorId", match.GetSelectorId())
			}
		}()

		for _, selector := range batch {
			if err := stream.Send(selector); err != nil {
				return nil, err
			}
			c.logger.Debug("Sent selector", "id", selector.GetId())
		}

		if err := stream.CloseSend(); err != nil {
			return nil, err
		}

		select {
		case err := <-errChan:
			return nil, err
		case <-doneChan:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return allMatches, nil
}

// RemoveSelectors starts a bidirectional streaming call to remove selectors
func (c *SelectorEngineClient) RemoveSelectors(ctx context.Context) (grpc.BidiStreamingClient[pb.ResourceSelectorRef, pb.Status], error) {
	return c.client.RemoveSelectors(ctx)
}

// RemoveSelectorsBatch removes selectors in batches of up to MaxBatchSize
func (c *SelectorEngineClient) RemoveSelectorsBatch(ctx context.Context, selectorRefs []*pb.ResourceSelectorRef) ([]*pb.Status, error) {
	var allStatuses []*pb.Status
	var mu sync.Mutex

	for i := 0; i < len(selectorRefs); i += MaxBatchSize {
		end := i + MaxBatchSize
		if end > len(selectorRefs) {
			end = len(selectorRefs)
		}
		c.logger.Info("Next RemoveSelectors batch", "startIndex", i, "endIndex", end)
		batch := selectorRefs[i:end]

		stream, err := c.client.RemoveSelectors(ctx)
		if err != nil {
			return nil, err
		}

		errChan := make(chan error, 1)
		doneChan := make(chan bool, 1)

		go func() {
			statusErrCount := 0
			for {
				status, err := stream.Recv()
				if err == io.EOF {
					doneChan <- true
					c.logger.Info("RemoveSelectors batch done", "status error count", statusErrCount)
					return
				}
				if err != nil {
					errChan <- err
					c.logger.Error("RemoveSelectors batch error", "error", err)
					return
				}
				mu.Lock()
				if status.GetError() {
					statusErrCount++
				}
				allStatuses = append(allStatuses, status)
				mu.Unlock()
				c.logger.Debug("Received status", "error", status.GetError(), "message", status.GetMessage())
			}
		}()

		for _, ref := range batch {
			if err := stream.Send(ref); err != nil {
				return nil, err
			}
			c.logger.Debug("Sent selector ref for removal", "id", ref.GetId())
		}

		if err := stream.CloseSend(); err != nil {
			return nil, err
		}

		select {
		case err := <-errChan:
			return nil, err
		case <-doneChan:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	return allStatuses, nil
}

// Example functions demonstrating usage

// LoadResourcesExample demonstrates how to use the LoadResources bidirectional stream with batching
func (c *SelectorEngineClient) LoadResourcesExample(ctx context.Context, resources []*pb.Resource) error {
	matches, err := c.LoadResourcesBatch(ctx, resources)
	if err != nil {
		return err
	}

	c.logger.Info("Loaded resources", "totalResources", len(resources), "totalMatches", len(matches))
	return nil
}

// RemoveResourcesExample demonstrates how to use the RemoveResources with batching
func (c *SelectorEngineClient) RemoveResourcesExample(ctx context.Context, resourceRefs []*pb.ResourceRef) error {
	statuses, err := c.RemoveResourcesBatch(ctx, resourceRefs)
	if err != nil {
		return err
	}

	c.logger.Info("Removed resources", "totalRefs", len(resourceRefs), "totalStatuses", len(statuses))
	return nil
}

// LoadSelectorsExample demonstrates how to use the LoadSelectors bidirectional stream with batching
func (c *SelectorEngineClient) LoadSelectorsExample(ctx context.Context, selectors []*pb.ResourceSelector) error {
	matches, err := c.LoadSelectorsBatch(ctx, selectors)
	if err != nil {
		return err
	}

	c.logger.Info("Loaded selectors", "totalSelectors", len(selectors), "totalMatches", len(matches))
	return nil
}

// RemoveSelectorsExample demonstrates how to use the RemoveSelectors with batching
func (c *SelectorEngineClient) RemoveSelectorsExample(ctx context.Context, selectorRefs []*pb.ResourceSelectorRef) error {
	statuses, err := c.RemoveSelectorsBatch(ctx, selectorRefs)
	if err != nil {
		return err
	}

	c.logger.Info("Removed selectors", "totalRefs", len(selectorRefs), "totalStatuses", len(statuses))
	return nil
}

// Helper functions for building test data

func BuildRandomResource(workspaceId string) *pb.Resource {
	return &pb.Resource{
		Id:          "id-" + RandomString(15),
		Name:        "name-" + RandomString(15),
		WorkspaceId: workspaceId,
		Identifier:  "identifier-" + RandomString(15),
		Kind:        "kind-" + RandomString(15),
		Version:     "version-" + RandomString(15),
		Metadata: map[string]string{
			"key1": "value1-" + RandomString(15),
			"key2": "value2-" + RandomString(15),
		},
		CreatedAt: nil,
		LastSync:  nil,
	}
}

func BuildRandomDeploymentSelector(resource *pb.Resource) *pb.ResourceSelector {
	return &pb.ResourceSelector{
		Id:          "selector-id-" + RandomString(15),
		WorkspaceId: resource.GetWorkspaceId(),
		EntityType:  "deployment",
		Condition:   BuildRandomCondition(resource),
	}
}

func BuildRandomEnvironmentSelector(resource *pb.Resource) *pb.ResourceSelector {
	return &pb.ResourceSelector{
		Id:          "selector-id-" + RandomString(15),
		WorkspaceId: resource.GetWorkspaceId(),
		EntityType:  "environment",
		Condition:   BuildRandomCondition(resource),
	}
}

func BuildRandomCondition(resource *pb.Resource) *pb.Condition {
	var nameCondition *pb.Condition
	var metadataCondition *pb.Condition
	var versionCondition *pb.Condition

	minLen := func(a, b int) int {
		if a < b {
			return a
		}
		return b
	}

	// Option 1: Name selector that checks if resource name starts with a prefix
	namePrefix := ""
	if len(resource.GetName()) > 0 {
		namePrefix = resource.GetName()[:minLen(3, len(resource.GetName()))] // Use first 3 chars as prefix
	} else {
		namePrefix = "test" // fallback
	}

	nameCondition = &pb.Condition{
		ConditionType: &pb.Condition_NameCondition{
			NameCondition: &pb.NameCondition{
				TypeField: pb.ConditionType_CONDITION_TYPE_NAME,
				Operator:  pb.ColumnOperator_COLUMN_OPERATOR_STARTS_WITH,
				Value:     namePrefix,
			},
		},
	}

	// Option 2: Metadata selector if resource has metadata
	if len(resource.GetMetadata()) > 0 {
		// Get the first metadata key-value pair
		for key, value := range resource.GetMetadata() {
			metadataCondition := &pb.Condition{
				ConditionType: &pb.Condition_MetadataValueCondition{
					MetadataValueCondition: &pb.MetadataValueCondition{
						TypeField: pb.ConditionType_CONDITION_TYPE_METADATA,
						Key:       key,
						Operator:  pb.MetadataOperator_METADATA_OPERATOR_EQUALS,
						Value:     value,
					},
				},
			}

			metadataCondition = &pb.Condition{
				ConditionType: &pb.Condition_ComparisonCondition{
					ComparisonCondition: &pb.ComparisonCondition{
						TypeField: pb.ConditionType_CONDITION_TYPE_COMPARISON,
						Operator:  pb.ComparisonOperator_COMPARISON_OPERATOR_AND,
						Conditions: []*pb.Condition{
							nameCondition,
							metadataCondition,
						},
						Depth: 0,
					},
				},
			}
		}
	}

	// Option 3: Version selector if resource has a version
	if resource.GetVersion() != "" {
		return &pb.Condition{
			ConditionType: &pb.Condition_VersionCondition{
				VersionCondition: &pb.VersionCondition{
					TypeField: pb.ConditionType_CONDITION_TYPE_VERSION,
					Operator:  pb.ColumnOperator_COLUMN_OPERATOR_EQUALS,
					Value:     resource.GetVersion(),
				},
			},
		}
	}

	// Randomly choose one of the conditions, falling back to nameCondition
	allConditions := []*pb.Condition{nameCondition, metadataCondition, versionCondition}
	randomIndex := rand.Intn(len(allConditions))
	selectedCondition := allConditions[randomIndex]
	if selectedCondition == nil {
		selectedCondition = nameCondition
	}
	return selectedCondition
}

func RandomString(i int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, i)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
