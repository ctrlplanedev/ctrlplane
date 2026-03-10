package main

import (
	"os"

	"github.com/charmbracelet/log"
	"workspace-engine/tools/seed/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		log.Error(err)
		os.Exit(1)
	}
}
