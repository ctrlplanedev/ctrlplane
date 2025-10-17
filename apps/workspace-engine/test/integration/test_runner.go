package integration

import "testing"

// TestFunc is a test function that can be run with different persistence modes
type TestFunc func(t *testing.T, mode PersistenceMode)

// RunWithBothPersistenceModes runs a test function twice:
// 1. With in-memory only mode
// 2. With disk persistence mode (save/load cycle after each event)
//
// This ensures that workspace state serialization/deserialization works correctly.
//
// Example usage:
//
//	func TestMyFeature(t *testing.T) {
//	    integration.RunWithBothPersistenceModes(t, func(t *testing.T, mode integration.PersistenceMode) {
//	        engine := integration.NewTestWorkspace(t,
//	            integration.WithPersistenceMode(mode),
//	            integration.WithSystem(
//	                integration.WithDeployment(),
//	            ),
//	        )
//	        // ... rest of test
//	    })
//	}
func RunWithBothPersistenceModes(t *testing.T, testFn TestFunc) {
	t.Helper()

	modes := []struct {
		name string
		mode PersistenceMode
	}{
		{"InMemoryOnly", InMemoryOnly},
		{"WithDiskPersistence", WithDiskPersistence},
	}

	for _, tc := range modes {
		t.Run(tc.name, func(t *testing.T) {
			testFn(t, tc.mode)
		})
	}
}
