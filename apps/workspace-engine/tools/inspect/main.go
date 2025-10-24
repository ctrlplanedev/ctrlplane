package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"workspace-engine/pkg/workspace"

	"github.com/spf13/cobra"
)

var (
	snapshotFile string
	verbose      bool
	outputFile   string
)

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "inspect",
	Short: "Inspect workspace snapshot files",
	Long:  `A CLI tool to inspect and explore gob-encoded workspace snapshot files.`,
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output")
	rootCmd.PersistentFlags().StringVarP(&outputFile, "output", "o", "", "Output file path (if not specified, prints to stdout)")

	rootCmd.AddCommand(allCmd)
	rootCmd.AddCommand(systemsCmd)
	rootCmd.AddCommand(environmentsCmd)
	rootCmd.AddCommand(deploymentsCmd)
	rootCmd.AddCommand(resourcesCmd)
	rootCmd.AddCommand(releasesCmd)
	rootCmd.AddCommand(releaseTargetsCmd)
	rootCmd.AddCommand(jobsCmd)
	rootCmd.AddCommand(jobAgentsCmd)
	rootCmd.AddCommand(policiesCmd)
	rootCmd.AddCommand(resourceProvidersCmd)
	rootCmd.AddCommand(infoCmd)
}

// Helper functions
func loadWorkspace(filePath string) (*workspace.Workspace, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "File size: %d bytes\n", len(data))
		fmt.Fprintln(os.Stderr, "Decoding workspace snapshot...")
	}

	ws := &workspace.Workspace{}
	if err := ws.GobDecode(data); err != nil {
		return nil, fmt.Errorf("failed to decode workspace: %w", err)
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "Successfully loaded workspace: %s\n\n", ws.ID)
	}

	return ws, nil
}

func printJSON(items interface{}) error {
	var output *os.File
	var err error

	if outputFile != "" {
		// Create or overwrite the output file
		output, err = os.Create(outputFile)
		if err != nil {
			return fmt.Errorf("failed to create output file: %w", err)
		}
		defer output.Close()

		if verbose {
			fmt.Fprintf(os.Stderr, "Writing output to: %s\n", outputFile)
		}
	} else {
		output = os.Stdout
	}

	encoder := json.NewEncoder(output)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(items); err != nil {
		return err
	}

	if outputFile != "" && verbose {
		fmt.Fprintf(os.Stderr, "Successfully wrote to: %s\n", outputFile)
	}

	return nil
}

func printCount(name string, count int) {
	fmt.Fprintf(os.Stderr, "%s: %d items\n", name, count)
}

// Info command - shows summary without full data
var infoCmd = &cobra.Command{
	Use:   "info <snapshot-file>",
	Short: "Show summary information about the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		store := ws.Store()
		fmt.Printf("Workspace ID: %s\n\n", ws.ID)
		fmt.Println("Store Contents:")
		fmt.Printf("  Systems:           %d\n", len(store.Systems.Items()))
		fmt.Printf("  Environments:      %d\n", len(store.Environments.Items()))
		fmt.Printf("  Deployments:       %d\n", len(store.Deployments.Items()))
		fmt.Printf("  Resources:         %d\n", len(store.Resources.Items()))
		fmt.Printf("  Releases:          %d\n", len(store.Releases.Items()))

		releaseTargets, err := store.ReleaseTargets.Items(context.Background())
		if err != nil {
			fmt.Printf("  Release Targets:   <error: %v>\n", err)
		} else {
			fmt.Printf("  Release Targets:   %d\n", len(releaseTargets))
		}

		fmt.Printf("  Jobs:              %d\n", len(store.Jobs.Items()))
		fmt.Printf("  Job Agents:        %d\n", len(store.JobAgents.Items()))
		fmt.Printf("  Policies:          %d\n", len(store.Policies.Items()))
		fmt.Printf("  Resource Providers: %d\n", len(store.ResourceProviders.Items()))

		return nil
	},
}

// All command - shows everything
var allCmd = &cobra.Command{
	Use:   "all <snapshot-file>",
	Short: "Show all data from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		store := ws.Store()

		result := map[string]interface{}{
			"workspaceId":       ws.ID,
			"systems":           store.Systems.Items(),
			"environments":      store.Environments.Items(),
			"deployments":       store.Deployments.Items(),
			"resources":         store.Resources.Items(),
			"releases":          store.Releases.Items(),
			"jobs":              store.Jobs.Items(),
			"jobAgents":         store.JobAgents.Items(),
			"policies":          store.Policies.Items(),
			"resourceProviders": store.ResourceProviders.Items(),
		}

		releaseTargets, err := store.ReleaseTargets.Items(context.Background())
		if err == nil {
			result["releaseTargets"] = releaseTargets
		}

		return printJSON(result)
	},
}

// Systems command
var systemsCmd = &cobra.Command{
	Use:   "systems <snapshot-file>",
	Short: "Show systems from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Systems.Items()
		if verbose {
			printCount("Systems", len(items))
		}
		return printJSON(items)
	},
}

// Environments command
var environmentsCmd = &cobra.Command{
	Use:   "environments <snapshot-file>",
	Short: "Show environments from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Environments.Items()
		if verbose {
			printCount("Environments", len(items))
		}
		return printJSON(items)
	},
}

// Deployments command
var deploymentsCmd = &cobra.Command{
	Use:   "deployments <snapshot-file>",
	Short: "Show deployments from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Deployments.Items()
		if verbose {
			printCount("Deployments", len(items))
		}
		return printJSON(items)
	},
}

// Resources command
var resourcesCmd = &cobra.Command{
	Use:   "resources <snapshot-file>",
	Short: "Show resources from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Resources.Items()
		if verbose {
			printCount("Resources", len(items))
		}
		return printJSON(items)
	},
}

// Releases command
var releasesCmd = &cobra.Command{
	Use:   "releases <snapshot-file>",
	Short: "Show releases from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Releases.Items()
		if verbose {
			printCount("Releases", len(items))
		}
		return printJSON(items)
	},
}

// Release Targets command
var releaseTargetsCmd = &cobra.Command{
	Use:   "release-targets <snapshot-file>",
	Short: "Show release targets from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items, err := ws.Store().ReleaseTargets.Items(context.Background())
		if err != nil {
			return fmt.Errorf("failed to get release targets: %w", err)
		}

		if verbose {
			printCount("Release Targets", len(items))
		}
		return printJSON(items)
	},
}

// Jobs command
var jobsCmd = &cobra.Command{
	Use:   "jobs <snapshot-file>",
	Short: "Show jobs from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Jobs.Items()
		if verbose {
			printCount("Jobs", len(items))
		}
		return printJSON(items)
	},
}

// Job Agents command
var jobAgentsCmd = &cobra.Command{
	Use:   "job-agents <snapshot-file>",
	Short: "Show job agents from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().JobAgents.Items()
		if verbose {
			printCount("Job Agents", len(items))
		}
		return printJSON(items)
	},
}

// Policies command
var policiesCmd = &cobra.Command{
	Use:   "policies <snapshot-file>",
	Short: "Show policies from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().Policies.Items()
		if verbose {
			printCount("Policies", len(items))
		}
		return printJSON(items)
	},
}

// Resource Providers command
var resourceProvidersCmd = &cobra.Command{
	Use:   "resource-providers <snapshot-file>",
	Short: "Show resource providers from the snapshot",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ws, err := loadWorkspace(args[0])
		if err != nil {
			return err
		}

		items := ws.Store().ResourceProviders.Items()
		if verbose {
			printCount("Resource Providers", len(items))
		}
		return printJSON(items)
	},
}
