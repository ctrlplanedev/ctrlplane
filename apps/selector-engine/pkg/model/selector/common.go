package selector

import "fmt"

func depthCheck(depth int) error {
	if depth >= MaxDepthAllowed {
		return fmt.Errorf("maximum selector depth (%d) exceeded", MaxDepthAllowed)
	}
	return nil
}
