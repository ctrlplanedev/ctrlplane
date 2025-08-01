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

	// Setup viper
	viper.BindPFlags(pflag.CommandLine)
	viper.SetEnvPrefix("SELECTOR_ENGINE")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	// Setup logger
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

	// Generate workspace IDs
	for range workspaceCount {
		workspaceIds = append(workspaceIds, client.RandomString(10))
	}

	// Generate resources
	for _, workspaceId := range workspaceIds {
		for range resourcesPerWorkspace {
			resources = append(resources, client.BuildRandomResource(workspaceId))
		}
	}

	// Generate selectors
	for _, r := range resources {
		deploymentSelectors = append(deploymentSelectors, client.BuildRandomDeploymentSelector(r))
		environmentSelectors = append(environmentSelectors, client.BuildRandomEnvironmentSelector(r))
	}

	ctx := context.Background()

	// Load deployment selectors
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

	// Load environment selectors
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

	// Load NEW resources
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

	// Load EXISTING resources (same resources again)
	logger.Info("Loading EXISTING resources...")
	existingResourceMatches, err := c.LoadResourcesBatch(ctx, resources)
	if err != nil {
		logger.Error("Failed to load existing resources", "error", err)
	} else {
		logger.Infof("Loaded %d existing resources across %d workspaces, %d total matches", len(resources), workspaceCount, len(existingResourceMatches))
		for _, match := range existingResourceMatches {
			logger.Debug("match for existing resource", "match", match)
		}
	}

	// Optional: demonstrate removal
	logger.Info("Client operations completed successfully")
}