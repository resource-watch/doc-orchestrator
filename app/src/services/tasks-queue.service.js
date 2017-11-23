const logger = require('logger');
const config = require('config');
const amqp = require('amqplib');
const TaskService = require('services/task.service');
const { task, execution } = require('doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const { TASKS_QUEUE } = require('app.constants');

class TasksQueueService {

    constructor() {
        logger.info(`Connecting to queue ${TASKS_QUEUE}`);
        try {
            this.init().then(() => {
                logger.info('Connected');
            }, (err) => {
                logger.error(err);
                process.exit(1);
            });
        } catch (err) {
            logger.error(err);
        }
    }

    async init() {
        const conn = await amqp.connect(config.get('rabbitmq.url'));
        this.channel = await conn.createConfirmChannel();
        const q = TASKS_QUEUE;
        this.channel.assertQueue(q, {
            durable: true
        });
        this.channel.prefetch(1);
        logger.info(` [*] Waiting for messages in ${q}`);
        this.channel.consume(q, this.consume.bind(this), {
            noAck: false
        });
    }

    formExecutionMessage(taskMsg) {
        // Create the message
        let executorTaskMessage;
        // Adding taskId
        taskMsg.taskId = taskMsg.id;
        switch (taskMsg.type) {

        case task.MESSAGE_TYPES.TASK_CREATE:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CREATE, taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_CONCAT:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CONCAT, taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_DELETE:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE, taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_OVERWRITE:
            // first step is delete the index, then we will catch the STATUS_INDEX_DELETED to create the new INDEX
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_DELETE_INDEX:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, taskMsg);
            break;
        default:
            logger.info('Default');

        }
        return executorTaskMessage;
    }

    async consume(msg) {
        logger.info('Message received from TASKS QUEUE', msg);
        const taskMsg = JSON.parse(msg.content.toString());
        let taskEntity;
        try {
            // Create mongo task entity
            taskEntity = await TaskService.create(taskMsg);
            // Generate message
            const executorTaskMessage = this.formExecutionMessage(taskMsg);
            // Send Message ExecutorTask Queue
            await ExecutorTaskQueueService.sendMessage(executorTaskMessage);
            // All OK -> msg sent, so ack emitted
            this.channel.ack(msg);
            logger.debug('msg accepted');
        } catch (err) {
            // Error creating entity or sending to queue
            logger.error(err);
            // Delete mongo task entity
            await TaskService.delete(taskEntity._id);
            const retries = msg.fields.deliveryTag;
            if (retries < 10) {
                this.channel.nack(msg);
            } else {
                this.channel.ack(msg);
            }
        }
    }

}

module.exports = new TasksQueueService();
