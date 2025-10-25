package pebble_test

import (
	"context"
	"fmt"
	"log"

	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/pebble"
)

// Deployment is an example entity
type Deployment struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

func (d *Deployment) CompactionKey() (string, string) {
	return "deployment", d.ID
}

// Environment is another example entity
type Environment struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (e *Environment) CompactionKey() (string, string) {
	return "environment", e.ID
}

func Example() {
	// Create a new Pebble store
	store, err := pebble.NewStore("./testdata/example-db")
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	// Register entity types
	store.RegisterEntityType("deployment", func() persistence.Entity {
		return &Deployment{}
	})
	store.RegisterEntityType("environment", func() persistence.Entity {
		return &Environment{}
	})

	ctx := context.Background()

	// Create some changes
	changes := persistence.NewChangesBuilder("workspace-1").
		Set(&Deployment{ID: "api", Name: "API Service", Version: "v1.0.0"}).
		Set(&Deployment{ID: "worker", Name: "Worker Service", Version: "v1.0.0"}).
		Set(&Environment{ID: "prod", Name: "Production"}).
		Build()

	// Save changes
	if err := store.Save(ctx, changes); err != nil {
		log.Fatal(err)
	}

	// Update a deployment (will overwrite the previous version)
	updateChanges := persistence.NewChangesBuilder("workspace-1").
		Set(&Deployment{ID: "api", Name: "API Service", Version: "v2.0.0"}).
		Build()

	if err := store.Save(ctx, updateChanges); err != nil {
		log.Fatal(err)
	}

	// Load current state
	loaded, err := store.Load(ctx, "workspace-1")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Loaded %d entities\n", len(loaded))

	// Print entities
	for _, change := range loaded {
		switch e := change.Entity.(type) {
		case *Deployment:
			fmt.Printf("Deployment: %s (version %s)\n", e.Name, e.Version)
		case *Environment:
			fmt.Printf("Environment: %s\n", e.Name)
		}
	}

	// Output:
	// Loaded 3 entities
	// Deployment: API Service (version v2.0.0)
	// Deployment: Worker Service (version v1.0.0)
	// Environment: Production
}

func ExampleStore_ListNamespaces() {
	store, err := pebble.NewStore("./testdata/example-list-db")
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	store.RegisterEntityType("deployment", func() persistence.Entity {
		return &Deployment{}
	})

	ctx := context.Background()

	// Create data in multiple workspaces
	for i := 1; i <= 3; i++ {
		namespace := fmt.Sprintf("workspace-%d", i)
		changes := persistence.NewChangesBuilder(namespace).
			Set(&Deployment{ID: "api", Name: "API Service", Version: "v1.0.0"}).
			Build()

		if err := store.Save(ctx, changes); err != nil {
			log.Fatal(err)
		}
	}

	// List all namespaces
	namespaces, err := store.ListNamespaces()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d workspaces\n", len(namespaces))
	for _, ns := range namespaces {
		fmt.Printf("- %s\n", ns)
	}

	// Output:
	// Found 3 workspaces
	// - workspace-1
	// - workspace-2
	// - workspace-3
}

func ExampleStore_DeleteNamespace() {
	store, err := pebble.NewStore("./testdata/example-delete-db")
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	store.RegisterEntityType("deployment", func() persistence.Entity {
		return &Deployment{}
	})

	ctx := context.Background()

	// Create data
	changes := persistence.NewChangesBuilder("workspace-1").
		Set(&Deployment{ID: "api", Name: "API Service", Version: "v1.0.0"}).
		Build()

	if err := store.Save(ctx, changes); err != nil {
		log.Fatal(err)
	}

	// Verify data exists
	loaded, _ := store.Load(ctx, "workspace-1")
	fmt.Printf("Before delete: %d entities\n", len(loaded))

	// Delete namespace
	if err := store.DeleteNamespace("workspace-1"); err != nil {
		log.Fatal(err)
	}

	// Verify data is gone
	loaded, _ = store.Load(ctx, "workspace-1")
	fmt.Printf("After delete: %d entities\n", len(loaded))

	// Output:
	// Before delete: 1 entities
	// After delete: 0 entities
}

func ExampleStore_automaticCompaction() {
	store, err := pebble.NewStore("./testdata/example-compact-db")
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	store.RegisterEntityType("deployment", func() persistence.Entity {
		return &Deployment{}
	})

	ctx := context.Background()

	// Save the same entity multiple times with different versions
	versions := []string{"v1.0.0", "v1.1.0", "v2.0.0", "v2.1.0"}
	for _, version := range versions {
		changes := persistence.NewChangesBuilder("workspace-1").
			Set(&Deployment{ID: "api", Name: "API Service", Version: version}).
			Build()

		if err := store.Save(ctx, changes); err != nil {
			log.Fatal(err)
		}
	}

	// Load - automatic compaction means we only get the latest version
	loaded, err := store.Load(ctx, "workspace-1")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Total entities: %d\n", len(loaded))
	if len(loaded) > 0 {
		deployment := loaded[0].Entity.(*Deployment)
		fmt.Printf("Latest version: %s\n", deployment.Version)
	}

	// Output:
	// Total entities: 1
	// Latest version: v2.1.0
}

