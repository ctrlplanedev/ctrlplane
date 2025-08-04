package main

import (
	"context"
	"strings"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/ctrlplanedev/selector-engine/pkg/client"
	"github.com/ctrlplanedev/selector-engine/pkg/logger"
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
		panic("Failed to bind flags: " + err.Error())
	}
	viper.SetEnvPrefix("SELECTOR_ENGINE")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	// Initialize logger singleton
	logger.Initialize(logger.Config{
		Level: viper.GetString("log-level"),
	})
	log := logger.Get()

	serverAddr := viper.GetString("server")
	c, err := client.NewClient(serverAddr)
	if err != nil {
		log.Fatal("Failed to create client", "error", err)
	}
	defer func(c *client.SelectorEngineClient) {
		err := c.Close()
		if err != nil {
			log.Error("Failed to close client", "error", err)
		} else {
			log.Info("Client closed successfully")
		}
	}(c)

	workspaceCount := viper.GetInt("workspace-count")
	resourcesPerWorkspace := viper.GetInt("resources-per-workspace")
	log.Infof("Starting selector engine client with %d workspaces and %d resources per workspace", workspaceCount, resourcesPerWorkspace)

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

	log.Info("Loading deployment selectors...")
	deploymentMatches, err := c.LoadSelectorsBatch(ctx, deploymentSelectors)
	if err != nil {
		log.Error("Failed to load deployment selectors", "error", err)
	} else {
		log.Infof("Loaded %d deployment selectors, received %d matches", len(deploymentSelectors), len(deploymentMatches))
		for _, match := range deploymentMatches {
			log.Debug("match for deployment selector", "match", match)
		}
	}

	log.Info("Loading environment selectors...")
	environmentMatches, err := c.LoadSelectorsBatch(ctx, environmentSelectors)
	if err != nil {
		log.Error("Failed to load environment selectors", "error", err)
	} else {
		log.Infof("Loaded %d environment selectors, received %d matches", len(environmentSelectors), len(environmentMatches))
		for _, match := range environmentMatches {
			log.Debug("match for environment selector", "match", match)
		}
	}

	totalSelectorCount := len(deploymentSelectors) + len(environmentSelectors)
	totalMatchCount := len(deploymentMatches) + len(environmentMatches)
	log.Infof("Loaded %d selectors across %d workspaces, %d total matches", totalSelectorCount, workspaceCount, totalMatchCount)

	log.Info("Loading NEW resources...")
	resourceMatches, err := c.LoadResourcesBatch(ctx, resources)
	if err != nil {
		log.Error("Failed to load resources", "error", err)
	} else {
		log.Infof("Loaded %d resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(resourceMatches))
		for _, match := range resourceMatches {
			log.Debug("match for resource", "match", match)
		}
	}

	log.Info("Loading EXISTING resources with NO UPDATES...")
	existingResourceMatches, err := c.LoadResourcesBatch(ctx, resources)
	if err != nil {
		log.Error("Failed to load existing resources", "error", err)
	} else {
		log.Infof("Loaded %d existing resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(existingResourceMatches))
		for _, match := range existingResourceMatches {
			log.Debug("match for existing resource", "match", match)
		}
	}

	log.Info("Loading resources with UPDATES to name (selectors with name condition should not match)...")
	updatedResources := make([]*pb.Resource, 0, len(resources))
	for _, r := range resources {
		// Update the resource by changing its name
		updatedResource := r
		updatedResource.Name = "updated-" + r.Name
		updatedResources = append(updatedResources, updatedResource)
	}
	updatedResourceMatches, err := c.LoadResourcesBatch(ctx, updatedResources)
	if err != nil {
		log.Error("Failed to load updated resources", "error", err)
	} else {
		log.Infof("Loaded %d updated resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(updatedResourceMatches))
		for _, match := range updatedResourceMatches {
			log.Debug("match for updated resource", "match", match)
		}
	}

	log.Info("Removing resources...")
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
		log.Error("Failed to remove resources", "error", err)
	} else {
		log.Infof("Removed %d resources across %d workspaces, %d total statuses", len(resources), workspaceCount, len(removeResourceStatuses))
		for _, status := range removeResourceStatuses {
			if status.Error {
				log.Error("Error removing resource", "status", status)
			} else {
				log.Debug("Successfully removed resource", "status", status)
			}
		}
	}

	log.Info("Removing environment selectors...")
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
		log.Error("Failed to remove environment selectors", "error", err)
	} else {
		log.Infof("Removed %d environment selectors across %d workspaces, %d total statuses", len(environmentSelectors), workspaceCount, len(removeEnvironmentSelectorStatuses))
		for _, status := range removeEnvironmentSelectorStatuses {
			if status.Error {
				log.Error("Error removing environment selector", "status", status)
			} else {
				log.Debug("Successfully removed environment selector", "status", status)
			}
		}
	}

	log.Info("Removing deployment selectors...")
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
		log.Error("Failed to remove deployment selectors", "error", err)
	} else {
		log.Infof("Removed %d deployment selectors across %d workspaces, %d total statuses", len(deploymentSelectors), workspaceCount, len(removeDeploymentSelectorStatuses))
		for _, status := range removeDeploymentSelectorStatuses {
			if status.Error {
				log.Error("Error removing deployment selector", "status", status)
			} else {
				log.Debug("Successfully removed deployment selector", "status", status)
			}
		}
	}

	// Optional: demonstrate removal
	log.Info("Client operations completed successfully")
}
