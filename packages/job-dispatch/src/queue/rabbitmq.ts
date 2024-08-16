// import type { JobExecution } from "@ctrlplane/db/schema";
// import type { Channel, Connection, ConsumeMessage } from "amqplib";
// import amqp from "amqplib";
// import ms from "ms";

// import type { JobQueue } from "./queue";

// /**
//  * RabbitMQ implementation of the JobQueue interface.
//  *
//  * @deprecated This implementation is not yet complete.
//  */
// export class RabbitMQService implements JobQueue {
//   private connection: Connection;
//   private channel: Channel;
//   private messageStore: Map<string, ConsumeMessage>;

//   constructor() {
//     this.messageStore = new Map<string, ConsumeMessage>();
//   }

//   private async init() {
//     this.connection = await amqp.connect("amqp://localhost");
//     this.channel = await this.connection.createChannel();
//   }

//   private async assertQueue(agentId: string) {
//     const queueName = `agent:${agentId}:queue`;
//     await this.channel.assertQueue(queueName, {
//       durable: true,
//       arguments: {
//         "x-message-ttl": ms("5m"),
//         "x-dead-letter-exchange": "", // Default exchange
//         "x-dead-letter-routing-key": queueName, // Requeue to the same queue
//       },
//     });
//     return queueName;
//   }

//   enqueue(agentId: string, jobs: JobExecution[]): void {
//     // Implementation
//   }

//   async acknowledge(agentId: string, jobExcutionId: string): Promise<void> {

//   }

//   async next(agentId: string): Promise<JobExecution[]> {
//     const queueName = await this.assertQueue(agentId);
//     const message = await this.channel.get(queueName, { noAck: false });
//     if (message == false) {
//       return [];
//     }
//     message.fields.deliveryTag
//   }
// }
