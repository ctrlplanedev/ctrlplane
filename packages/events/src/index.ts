import type { EventDispatcher } from "./event-dispatcher.js";
import { KafkaEventDispatcher } from "./kafka/index.js";

export * from "./resource-provider-scan/handle-provider-scan.js";
export * from "./kafka/index.js";

export const eventDispatcher: EventDispatcher = new KafkaEventDispatcher();
