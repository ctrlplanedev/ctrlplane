package cmd

import (
	"os"

	"github.com/charmbracelet/log"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

var (
	bootstrapServer string
	workspaceID     string
	envFile         string
)

var rootCmd = &cobra.Command{
	Use:   "seed",
	Short: "Seed workspace data into Kafka",
	Long: `A CLI tool to seed workspace data into Kafka.
Supports seeding from JSON files or generating random resources.

Environment variables can be loaded from a .env file in the current directory,
or from a custom file specified with --env-file.`,
	PersistentPreRun: loadEnvFile,
}

func Execute() error {
	return rootCmd.Execute()
}

func loadEnvFile(cmd *cobra.Command, args []string) {
	// Try to load .env file
	envPath := envFile
	if envPath == "" {
		envPath = ".env"
	}

	// Check if file exists
	if _, err := os.Stat(envPath); err == nil {
		if err := godotenv.Load(envPath); err != nil {
			log.Warnf("Failed to load env file %s: %v", envPath, err)
		} else {
			log.Debugf("Loaded environment variables from %s", envPath)
		}
	} else if envFile != "" {
		// Only warn if user explicitly specified an env file
		log.Warnf("Env file %s not found", envPath)
	}

	// Override flags with environment variables if not set via command line
	if !cmd.Flags().Changed("bootstrap-server") && os.Getenv("BOOTSTRAP_SERVER") != "" {
		bootstrapServer = os.Getenv("BOOTSTRAP_SERVER")
		log.Debugf("Using BOOTSTRAP_SERVER from environment: %s", bootstrapServer)
	}

	if !cmd.Flags().Changed("workspace-id") && os.Getenv("WORKSPACE_ID") != "" {
		workspaceID = os.Getenv("WORKSPACE_ID")
		log.Debugf("Using WORKSPACE_ID from environment: %s", workspaceID)
	}

	// Validate required fields
	if workspaceID == "" {
		log.Fatal("workspace-id is required (set via --workspace-id flag or WORKSPACE_ID environment variable)")
	}
}

func init() {
	// Global flags
	rootCmd.PersistentFlags().StringVar(&bootstrapServer, "bootstrap-server", "localhost:9092", "Kafka bootstrap server")
	rootCmd.PersistentFlags().StringVar(&workspaceID, "workspace-id", "", "Workspace ID (required)")
	rootCmd.PersistentFlags().StringVar(&envFile, "env-file", "", "Path to .env file (default: .env in current directory)")
}

