const logger = require('logger');
const config = require('config');
const amqp = require('amqplib/callback_api');
const { TASKS_QUEUE } = require('app.constants');
const TaskService = require('services/task.service');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const message = require('doc-importer-messages');

class TasksQueueService {

    constructor() {
        logger.info(`Connecting to queue ${TASKS_QUEUE}`);
        amqp.connect(config.get('rabbitmq.url'), (err, conn) => {
            if (err) {
                logger.error(err);
                process.exit(1);
            }
            conn.createChannel((err, ch) => {
                const q = TASKS_QUEUE;
                this.channel = ch;
                ch.assertQueue(q, {
                    durable: true,
                    maxLength: 10
                });
                ch.prefetch(1);
                logger.info(` [*] Waiting for messages in ${q}`);
                ch.consume(q, this.consume.bind(this), {
                    noAck: false
                });
            });
        });
    }

    async consume(msg) {
        logger.info('Message received from TASKS QUEUE', msg);
        try {
            const taskMessage = JSON.parse(msg.content.toString());
            // 1. Create the message
            const executorTaskMessage = message(taskMessage.type, taskMessage);
            // 2. Create mongo entity
            await TaskService.create(executorTaskMessage);
            // 3. Send the message to ExecutorTaskQueue
            await ExecutorTaskQueueService.sendMessage(executorTaskMessage);
            this.channel.ack(msg);
        } catch (err) {
            logger.error(err);
            const retries = msg.fields.deliveryTag;
            if (retries < 1000) {
                this.channel.nack(msg);
            } else {
                this.channel.ack(msg);
            }
        }
    }

}

module.exports = new TasksQueueService();
