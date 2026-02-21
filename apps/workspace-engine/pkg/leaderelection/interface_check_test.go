package leaderelection_test

import (
	le "workspace-engine/pkg/leaderelection"
	"workspace-engine/pkg/leaderelection/postgres"
)

var (
	_ le.LeaderElector = (*postgres.AdvisoryLockElector)(nil)
)
