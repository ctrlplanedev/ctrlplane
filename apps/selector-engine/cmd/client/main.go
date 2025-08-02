package main

import (
	"context"
	"os"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/ctrlplanedev/selector-engine/pkg/client"
	pb "github.com/ctrlplanedev/selector-engine/pkg/pb/proto"
)

func main() {
	// Setup flags
	pflag.String("server", "localhost:50555", "The server address")
	pflag.String("log-level", "info", "Log level (debug, info, warn, error)")
	pflag.Int("resources-per-workspace", 5000, "Number of resources per workspace")
	pflag.Int("workspace-count", 5, "Number of workspaces")
	pflag.Parse()

	if err := viper.BindPFlags(pflag.CommandLine); err != nil {
		log.Fatal("Failed to bind flags", "error", err)
	}
	viper.SetEnvPrefix("SELECTOR_ENGINE")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	logLevel := viper.GetString("log-level")
	logger := log.NewWithOptions(os.Stderr, log.Options{ReportTimestamp: true})
	switch strings.ToLower(logLevel) {
	case "debug":
		logger.SetLevel(log.DebugLevel)
	case "info":
		logger.SetLevel(log.InfoLevel)
	case "warn":
		logger.SetLevel(log.WarnLevel)
	case "error":
		logger.SetLevel(log.ErrorLevel)
	default:
		logger.SetLevel(log.InfoLevel)
	}

	serverAddr := viper.GetString("server")
	c, err := client.NewClient(serverAddr)
	if err != nil {
		logger.Fatal("Failed to create client", "error", err)
	}
	defer func(c *client.SelectorEngineClient) {
		err := c.Close()
		if err != nil {
			logger.Error("Failed to close client", "error", err)
		} else {
			logger.Info("Client closed successfully")
		}
	}(c)

	workspaceCount := viper.GetInt("workspace-count")
	resourcesPerWorkspace := viper.GetInt("resources-per-workspace")
	logger.Infof("Starting selector engine client with %d workspaces and %d resources per workspace", workspaceCount, resourcesPerWorkspace)

	var workspaceIds = make([]string, 0)
	var resources []*pb.Resource = make([]*pb.Resource, 0)
	var deploymentSelectors []*pb.ResourceSelector = make([]*pb.ResourceSelector, 0)
	var environmentSelectors []*pb.ResourceSelector = make([]*pb.ResourceSelector, 0)

	for range workspaceCount {
		workspaceIds = append(workspaceIds, client.RandomString(10))
	}

	for _, workspaceId := range workspaceIds {
		for range resourcesPerWorkspace {
			resources = append(resources, client.BuildRandomResource(workspaceId))
		}
	}

	for _, r := range resources {
		deploymentSelectors = append(deploymentSelectors, client.BuildRandomDeploymentSelector(r))
		environmentSelectors = append(environmentSelectors, client.BuildRandomEnvironmentSelector(r))
	}

	ctx := context.Background()

	logger.Info("Loading deployment selectors...")
	deploymentMatches, err := c.LoadSelectorsBatch(ctx, deploymentSelectors)
	if err != nil {
		logger.Error("Failed to load deployment selectors", "error", err)
	} else {
		logger.Infof("Loaded %d deployment selectors, received %d matches", len(deploymentSelectors), len(deploymentMatches))
		for _, match := range deploymentMatches {
			logger.Debug("match for deployment selector", "match", match)
		}
	}

	logger.Info("Loading environment selectors...")
	environmentMatches, err := c.LoadSelectorsBatch(ctx, environmentSelectors)
	if err != nil {
		logger.Error("Failed to load environment selectors", "error", err)
	} else {
		logger.Infof("Loaded %d environment selectors, received %d matches", len(environmentSelectors), len(environmentMatches))
		for _, match := range environmentMatches {
			logger.Debug("match for environment selector", "match", match)
		}
	}

	totalSelectorCount := len(deploymentSelectors) + len(environmentSelectors)
	totalMatchCount := len(deploymentMatches) + len(environmentMatches)
	logger.Infof("Loaded %d selectors across %d workspaces, %d total matches", totalSelectorCount, workspaceCount, totalMatchCount)

	logger.Info("Loading NEW resources...")
	resourceMatches, err := c.LoadResourcesBatch(ctx, resources)
	if err != nil {
		logger.Error("Failed to load resources", "error", err)
	} else {
		logger.Infof("Loaded %d resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(resourceMatches))
		for _, match := range resourceMatches {
			logger.Debug("match for resource", "match", match)
		}
	}

	logger.Info("Loading EXISTING resources with NO UPDATES...")
	existingResourceMatches, err := c.LoadResourcesBatch(ctx, resources)
	if err != nil {
		logger.Error("Failed to load existing resources", "error", err)
	} else {
		logger.Infof("Loaded %d existing resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(existingResourceMatches))
		for _, match := range existingResourceMatches {
			logger.Debug("match for existing resource", "match", match)
		}
	}

	logger.Info("Loading resources with UPDATES to name (selectors with name condition should not match)...")
	updatedResources := make([]*pb.Resource, 0, len(resources))
	for _, r := range resources {
		// Update the resource by changing its name
		updatedResource := r
		updatedResource.Name = "updated-" + r.Name
		updatedResources = append(updatedResources, updatedResource)
	}
	updatedResourceMatches, err := c.LoadResourcesBatch(ctx, updatedResources)
	if err != nil {
		logger.Error("Failed to load updated resources", "error", err)
	} else {
		logger.Infof("Loaded %d updated resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(updatedResourceMatches))
		for _, match := range updatedResourceMatches {
			logger.Debug("match for updated resource", "match", match)
		}
	}

	logger.Info("Removing resources...")
	resourceRefs := make([]*pb.ResourceRef, 0, len(resources))
	for _, r := range resources {
		resourceRef := &pb.ResourceRef{
			Id:          r.Id,
			WorkspaceId: r.WorkspaceId,
		}
		resourceRefs = append(resourceRefs, resourceRef)
	}
	removeResourceStatuses, err := c.RemoveResourcesBatch(ctx, resourceRefs)
	if err != nil {
		logger.Error("Failed to remove resources", "error", err)
	} else {
		logger.Infof("Removed %d resources across %d workspaces, %d total statuses", len(resources), workspaceCount, len(removeResourceStatuses))
		for _, status := range removeResourceStatuses {
			if status.Error {
				logger.Error("Error removing resource", "status", status)
			} else {
				logger.Debug("Successfully removed resource", "status", status)
			}
		}
	}

	logger.Info("Removing environment selectors...")
	environmentSelectorRefs := make([]*pb.ResourceSelectorRef, 0, len(environmentSelectors))
	for _, sel := range environmentSelectors {
		selectorRef := &pb.ResourceSelectorRef{
			Id:          sel.Id,
			WorkspaceId: sel.WorkspaceId,
		}
		environmentSelectorRefs = append(environmentSelectorRefs, selectorRef)
	}
	removeEnvironmentSelectorStatuses, err := c.RemoveSelectorsBatch(ctx, environmentSelectorRefs)
	if err != nil {
		logger.Error("Failed to remove environment selectors", "error", err)
	} else {
		logger.Infof("Removed %d environment selectors across %d workspaces, %d total statuses", len(environmentSelectors), workspaceCount, len(removeEnvironmentSelectorStatuses))
		for _, status := range removeEnvironmentSelectorStatuses {
			if status.Error {
				logger.Error("Error removing environment selector", "status", status)
			} else {
				logger.Debug("Successfully removed environment selector", "status", status)
			}
		}
	}

	logger.Info("Removing deployment selectors...")
	deploymentSelectorRefs := make([]*pb.ResourceSelectorRef, 0, len(deploymentSelectors))
	for _, sel := range deploymentSelectors {
		selectorRef := &pb.ResourceSelectorRef{
			Id:          sel.Id,
			WorkspaceId: sel.WorkspaceId,
		}
		deploymentSelectorRefs = append(deploymentSelectorRefs, selectorRef)
	}
	removeDeploymentSelectorStatuses, err := c.RemoveSelectorsBatch(ctx, deploymentSelectorRefs)
	if err != nil {
		logger.Error("Failed to remove deployment selectors", "error", err)
	} else {
		logger.Infof("Removed %d deployment selectors across %d workspaces, %d total statuses", len(deploymentSelectors), workspaceCount, len(removeDeploymentSelectorStatuses))
		for _, status := range removeDeploymentSelectorStatuses {
			if status.Error {
				logger.Error("Error removing deployment selector", "status", status)
			} else {
				logger.Debug("Successfully removed deployment selector", "status", status)
			}
		}
	}

	// Optional: demonstrate removal
	logger.Info("Client operations completed successfully")
}
