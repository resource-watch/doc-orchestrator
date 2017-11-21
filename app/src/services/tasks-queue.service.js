const logger = require('logger');
const config = require('config');
const amqp = require('amqplib/callback_api');
const TaskService = require('services/task.service');
const { task, execution } = require('doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const { TASKS_QUEUE } = require('app.constants');

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

    formExecutionMessage(msg) {
        // Create the message
        let executorTaskMessage;
        switch (msg.type) {

        case task.MESSAGE_TYPES.TASK_CREATE:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CREATE, msg);
            break;
        case task.MESSAGE_TYPES.TASK_CONCAT:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CONCAT, msg);
            break;
        case task.MESSAGE_TYPES.TASK_DELETE:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE, msg);
            break;
        case task.MESSAGE_TYPES.TASK_OVERWRITE:
            // @TODO add EXECUTION_DELETE_INDEX message
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, msg);
            break;
        default:
            logger.info('Default');

        }
        return executorTaskMessage;
    }

    async consume(msg) {
        logger.info('Message received from TASKS QUEUE', msg);
        const msgContent = JSON.parse(msg.content.toString());
        let taskEntity;
        try {
            // Create mongo task entity
            taskEntity = await TaskService.create(msgContent);
            // Generate message
            const executorTaskMessage = this.formExecutionMessage(taskEntity);
            // Send Message ExecutorTask Queue
            await ExecutorTaskQueueService.sendMessage(executorTaskMessage);
            // All OK -> msg sent, so ack emitted
            this.channel.ack(msg);
        } catch (err) {
            // Error creating entity or sending to queue
            logger.error(err);
            // Delete mongo task entity
            await TaskService.delete(taskEntity._id);
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
