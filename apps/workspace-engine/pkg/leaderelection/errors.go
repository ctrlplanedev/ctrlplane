package leaderelection

import "errors"

var (
	ErrMissingIdentity      = errors.New("leaderelection: identity must not be empty")
	ErrMissingLockName      = errors.New("leaderelection: lock name must not be empty")
	ErrInvalidLeaseDuration = errors.New("leaderelection: lease duration must be positive")
	ErrInvalidRenewDeadline = errors.New("leaderelection: renew deadline must be positive and less than lease duration")
	ErrInvalidRetryPeriod   = errors.New("leaderelection: retry period must be positive and less than renew deadline")
	ErrNotLeader            = errors.New("leaderelection: not the leader")
)
