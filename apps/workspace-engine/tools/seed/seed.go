package main

import (
	"os"
	"workspace-engine/tools/seed/cmd"

	"github.com/charmbracelet/log"
)

func main() {
	if err := cmd.Execute(); err != nil {
		log.Error(err)
		os.Exit(1)
	}
}
