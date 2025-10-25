package cmd

import (
	"github.com/spf13/cobra"
)

var (
	bootstrapServer string
	workspaceID     string
)

var rootCmd = &cobra.Command{
	Use:   "seed",
	Short: "Seed workspace data into Kafka",
	Long: `A CLI tool to seed workspace data into Kafka.
Supports seeding from JSON files or generating random resources.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Global flags
	rootCmd.PersistentFlags().StringVar(&bootstrapServer, "bootstrap-server", "localhost:9092", "Kafka bootstrap server")
	rootCmd.PersistentFlags().StringVar(&workspaceID, "workspace-id", "", "Workspace ID (required)")
	rootCmd.MarkPersistentFlagRequired("workspace-id")
}

