package deployment

import (
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestReleaseTarget(resourceID, envID, deploymentID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: envID,
		DeploymentId:  deploymentID,
	}
}

func TestNewReconciliationScheduler(t *testing.T) {
	scheduler := NewReconciliationScheduler()

	assert.NotNil(t, scheduler)
	assert.NotNil(t, scheduler.schedule)
}

func TestScheduler_Schedule(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")
	nextTime := time.Now().Add(10 * time.Minute)

	scheduler.Schedule(rt, nextTime)

	scheduledTime, exists := scheduler.GetNextReconciliationTime(rt)
	assert.True(t, exists)
	assert.Equal(t, nextTime, scheduledTime)
}

func TestScheduler_Schedule_KeepsSoonerTime(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")

	laterTime := time.Now().Add(20 * time.Minute)
	soonerTime := time.Now().Add(5 * time.Minute)

	// Schedule later time first
	scheduler.Schedule(rt, laterTime)

	// Schedule sooner time - should replace
	scheduler.Schedule(rt, soonerTime)

	scheduledTime, exists := scheduler.GetNextReconciliationTime(rt)
	assert.True(t, exists)
	assert.Equal(t, soonerTime, scheduledTime, "should keep the sooner time")
}

func TestScheduler_Schedule_DoesNotReplaceWithLaterTime(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")

	soonerTime := time.Now().Add(5 * time.Minute)
	laterTime := time.Now().Add(20 * time.Minute)

	// Schedule sooner time first
	scheduler.Schedule(rt, soonerTime)

	// Try to schedule later time - should not replace
	scheduler.Schedule(rt, laterTime)

	scheduledTime, exists := scheduler.GetNextReconciliationTime(rt)
	assert.True(t, exists)
	assert.Equal(t, soonerTime, scheduledTime, "should keep the sooner time")
}

func TestScheduler_Remove(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")
	nextTime := time.Now().Add(10 * time.Minute)

	scheduler.Schedule(rt, nextTime)
	assert.Equal(t, 1, scheduler.Size())

	scheduler.Remove(rt)
	assert.Equal(t, 0, scheduler.Size())

	_, exists := scheduler.GetNextReconciliationTime(rt)
	assert.False(t, exists, "target should not be in schedule after removal")
}

func TestScheduler_Remove_NonExistent(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")

	// Removing non-existent target should not panic
	assert.NotPanics(t, func() {
		scheduler.Remove(rt)
	})
}

func TestScheduler_GetDue(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	rt1 := newTestReleaseTarget("res-1", "env-1", "dep-1")
	rt2 := newTestReleaseTarget("res-2", "env-1", "dep-1")
	rt3 := newTestReleaseTarget("res-3", "env-1", "dep-1")

	// Schedule rt1 in the past (due)
	scheduler.Schedule(rt1, now.Add(-5*time.Minute))

	// Schedule rt2 right now (due)
	scheduler.Schedule(rt2, now)

	// Schedule rt3 in the future (not due)
	scheduler.Schedule(rt3, now.Add(10*time.Minute))

	dueKeys := scheduler.GetDue(now)

	assert.Len(t, dueKeys, 2, "should have 2 due targets")
	assert.Contains(t, dueKeys, rt1.Key())
	assert.Contains(t, dueKeys, rt2.Key())
	assert.NotContains(t, dueKeys, rt3.Key())
}

func TestScheduler_GetDue_EmptySchedule(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	dueKeys := scheduler.GetDue(now)

	assert.Empty(t, dueKeys)
}

func TestScheduler_Clear(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	rt1 := newTestReleaseTarget("res-1", "env-1", "dep-1")
	rt2 := newTestReleaseTarget("res-2", "env-1", "dep-1")
	rt3 := newTestReleaseTarget("res-3", "env-1", "dep-1")

	scheduler.Schedule(rt1, now)
	scheduler.Schedule(rt2, now)
	scheduler.Schedule(rt3, now)
	assert.Equal(t, 3, scheduler.Size())

	// Clear rt1 and rt2
	scheduler.Clear([]string{rt1.Key(), rt2.Key()})

	assert.Equal(t, 1, scheduler.Size())
	_, exists := scheduler.GetNextReconciliationTime(rt3)
	assert.True(t, exists, "rt3 should still be in schedule")

	_, exists = scheduler.GetNextReconciliationTime(rt1)
	assert.False(t, exists, "rt1 should be cleared")

	_, exists = scheduler.GetNextReconciliationTime(rt2)
	assert.False(t, exists, "rt2 should be cleared")
}

func TestScheduler_Clear_EmptyKeys(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")

	scheduler.Schedule(rt, time.Now())
	assert.Equal(t, 1, scheduler.Size())

	scheduler.Clear([]string{})

	assert.Equal(t, 1, scheduler.Size(), "should not affect schedule")
}

func TestScheduler_GetNextReconciliationTime_NotScheduled(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")

	scheduledTime, exists := scheduler.GetNextReconciliationTime(rt)

	assert.False(t, exists)
	assert.True(t, scheduledTime.IsZero())
}

func TestScheduler_Size(t *testing.T) {
	scheduler := NewReconciliationScheduler()

	assert.Equal(t, 0, scheduler.Size())

	rt1 := newTestReleaseTarget("res-1", "env-1", "dep-1")
	rt2 := newTestReleaseTarget("res-2", "env-1", "dep-1")

	scheduler.Schedule(rt1, time.Now())
	assert.Equal(t, 1, scheduler.Size())

	scheduler.Schedule(rt2, time.Now())
	assert.Equal(t, 2, scheduler.Size())

	scheduler.Remove(rt1)
	assert.Equal(t, 1, scheduler.Size())
}

func TestScheduler_MultipleTargetsSameResource(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	// Same resource, different environments
	rt1 := newTestReleaseTarget("res-1", "env-prod", "dep-1")
	rt2 := newTestReleaseTarget("res-1", "env-staging", "dep-1")

	scheduler.Schedule(rt1, now.Add(5*time.Minute))
	scheduler.Schedule(rt2, now.Add(10*time.Minute))

	assert.Equal(t, 2, scheduler.Size(), "should schedule both targets separately")

	time1, exists1 := scheduler.GetNextReconciliationTime(rt1)
	time2, exists2 := scheduler.GetNextReconciliationTime(rt2)

	assert.True(t, exists1)
	assert.True(t, exists2)
	assert.NotEqual(t, time1, time2, "should have different scheduled times")
}

func TestScheduler_ConcurrentSchedule(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	var wg sync.WaitGroup
	now := time.Now()

	// Concurrently schedule 100 targets
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rt := newTestReleaseTarget("res-"+string(rune(idx)), "env-1", "dep-1")
			scheduler.Schedule(rt, now.Add(time.Duration(idx)*time.Minute))
		}(i)
	}

	wg.Wait()
	assert.Equal(t, 100, scheduler.Size())
}

func TestScheduler_ConcurrentGetDueAndClear(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	// Schedule some targets
	for i := 0; i < 50; i++ {
		rt := newTestReleaseTarget("res-"+string(rune(i)), "env-1", "dep-1")
		scheduler.Schedule(rt, now.Add(-time.Duration(i)*time.Minute))
	}

	var wg sync.WaitGroup

	// Concurrently call GetDue
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			scheduler.GetDue(now)
		}()
	}

	// Concurrently call Clear
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rt := newTestReleaseTarget("res-"+string(rune(idx)), "env-1", "dep-1")
			scheduler.Clear([]string{rt.Key()})
		}(i)
	}

	wg.Wait()
	// Should not panic - test passes if no race condition
}

func TestScheduler_RescheduleTarget(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	rt := newTestReleaseTarget("res-1", "env-1", "dep-1")

	time1 := time.Now().Add(10 * time.Minute)
	time2 := time.Now().Add(5 * time.Minute)
	time3 := time.Now().Add(15 * time.Minute)

	// Initial schedule
	scheduler.Schedule(rt, time1)
	scheduledTime, _ := scheduler.GetNextReconciliationTime(rt)
	assert.Equal(t, time1, scheduledTime)

	// Reschedule with sooner time - should update
	scheduler.Schedule(rt, time2)
	scheduledTime, _ = scheduler.GetNextReconciliationTime(rt)
	assert.Equal(t, time2, scheduledTime)

	// Try to reschedule with later time - should keep sooner time
	scheduler.Schedule(rt, time3)
	scheduledTime, _ = scheduler.GetNextReconciliationTime(rt)
	assert.Equal(t, time2, scheduledTime, "should still have the soonest time")
}

func TestScheduler_Integration_TypicalWorkflow(t *testing.T) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	// Simulate typical workflow
	rt1 := newTestReleaseTarget("res-1", "env-1", "dep-1")
	rt2 := newTestReleaseTarget("res-2", "env-1", "dep-1")
	rt3 := newTestReleaseTarget("res-3", "env-1", "dep-1")

	// Schedule targets for different times
	scheduler.Schedule(rt1, now.Add(-5*time.Minute)) // Past - due now
	scheduler.Schedule(rt2, now.Add(5*time.Minute))  // Future
	scheduler.Schedule(rt3, now.Add(-2*time.Minute)) // Past - due now

	require.Equal(t, 3, scheduler.Size())

	// Get due targets
	dueKeys := scheduler.GetDue(now)
	require.Len(t, dueKeys, 2)
	require.Contains(t, dueKeys, rt1.Key())
	require.Contains(t, dueKeys, rt3.Key())

	// Process and clear due targets
	scheduler.Clear(dueKeys)
	require.Equal(t, 1, scheduler.Size(), "only rt2 should remain")

	// Verify rt2 is still scheduled
	_, exists := scheduler.GetNextReconciliationTime(rt2)
	require.True(t, exists)

	// Verify rt1 and rt3 are cleared
	_, exists = scheduler.GetNextReconciliationTime(rt1)
	require.False(t, exists)
	_, exists = scheduler.GetNextReconciliationTime(rt3)
	require.False(t, exists)

	// Delete rt2
	scheduler.Remove(rt2)
	require.Equal(t, 0, scheduler.Size(), "schedule should be empty")
}

func BenchmarkScheduler_Schedule(b *testing.B) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rt := newTestReleaseTarget("res-"+string(rune(i%1000)), "env-1", "dep-1")
		scheduler.Schedule(rt, now.Add(time.Duration(i)*time.Minute))
	}
}

func BenchmarkScheduler_GetDue(b *testing.B) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	// Pre-populate with 1000 targets
	for i := 0; i < 1000; i++ {
		rt := newTestReleaseTarget("res-"+string(rune(i)), "env-1", "dep-1")
		scheduler.Schedule(rt, now.Add(time.Duration(i)*time.Minute))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		scheduler.GetDue(now)
	}
}

func BenchmarkScheduler_ConcurrentOperations(b *testing.B) {
	scheduler := NewReconciliationScheduler()
	now := time.Now()

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			rt := newTestReleaseTarget("res-"+string(rune(i%100)), "env-1", "dep-1")
			scheduler.Schedule(rt, now.Add(time.Duration(i)*time.Minute))
			scheduler.GetDue(now)
			i++
		}
	})
}
