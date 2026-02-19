package messaging

import "fmt"

var sharedProducer Producer

func InitProducer(p Producer) {
	sharedProducer = p
}

func Publish(key []byte, value []byte) error {
	if sharedProducer == nil {
		return fmt.Errorf("shared kafka producer not initialized — call messaging.InitProducer first")
	}
	return sharedProducer.Publish(key, value)
}

func CloseProducer() error {
	if sharedProducer != nil {
		return sharedProducer.Close()
	}
	return nil
}
