const logger = require('logger');
const config = require('config');
const amqp = require('amqplib');
const TaskService = require('services/task.service');
const DatasetService = require('services/task.service');
const { execution, status, task } = require('doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const { STATUS_QUEUE } = require('app.constants');
const STATUS = require('app.constants').STATUS;

class StatusQueueService {

    constructor() {
        logger.info(`Connecting to queue ${STATUS_QUEUE}`);
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
        const q = STATUS_QUEUE;
        this.channel.assertQueue(q, {
            durable: true
        });
        this.channel.prefetch(1);
        logger.info(` [*] Waiting for messages in ${q}`);
        this.channel.consume(q, this.consume.bind(this), {
            noAck: false
        });
    }

    async generateExecutionTask(id, type) {
        const currentTask = await TaskService.get(id);
        return execution.createMessage(type, currentTask);
    }

    async processMessage(statusMsg) {
        // Sometimes it will get the task from Mongo (we will need it to compare the current state in
        // cases of fork)
        // const task = await TaskService.get(statusMsg.taskId);
        switch (statusMsg.type) {

        case status.MESSAGE_TYPES.STATUS_INDEX_CREATED:
            // From INIT to INDEX_CREATED
            await TaskService.updateStatus(STATUS.INDEX_CREATED);
            break;
        case status.MESSAGE_TYPES.STATUS_READ_DATA:
            // Executor says that it's read a piece of data
            await TaskService.addRead(statusMsg.taskId);
            break;
        case status.MESSAGE_TYPES.STATUS_READ_FILE:
            // The file has been read completely, just update the status
            await TaskService.updateStatus(statusMsg.taskId, STATUS.READ);
            break;
        case status.MESSAGE_TYPES.STATUS_WRITTEN_DATA: {
            // add write +1
            await TaskService.addWrite(statusMsg.taskId);
            // AND NOW CHECK IF WRITES-READS == 0 and STATUS == READ
            const finished = await TaskService.checkCounter(statusMsg.taskId);
            if (finished) {
                // Sending confirm index creation
                await ExecutorTaskQueueService.sendMessage(this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_CONFIRM_INDEX_CREATION));
            }
            break;
        }
        case status.MESSAGE_TYPES.STATUS_PERFORMED_DELETE_QUERY:
            await TaskService.updateStatus(statusMsg.taskId, STATUS.PERFORMED_DELETE_QUERY);
            break;
        case status.MESSAGE_TYPES.STATUS_FINISHED_DELETE_QUERY:
            await TaskService.updateStatus(statusMsg.taskId, STATUS.FINISHED_DELETE_QUERY);
            // update dataset
            await DatasetService.updateStatus();
            break;
        case status.MESSAGE_TYPES.STATUS_INDEX_DELETED: {
            await TaskService.updateStatus(statusMsg.taskId, STATUS.INDEX_DELETED);
            const currentTask = await TaskService.get(statusMsg.taskId);
            // From delete index operation or OVERWRITE?
            if (currentTask.type === task.MESSAGE_TYPES.TASK_DELETE_INDEX) {
                // delete index
                await DatasetService.updateStatus();
            } else {
                // it comes from an OVERWRITE OPERATION, we gotta launch a create Task
                // Sending a create message to execution queue
                await ExecutorTaskQueueService.sendMessage(this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_CREATE));
            }
            break;
        }
        case status.MESSAGE_TYPES.STATUS_INDEX_CONFIRMED:
            await DatasetService.updateStatus();
            break;
        default:
            logger.info('do nothing?');

        }
    }

    async consume(msg) {
        logger.info('Message received', msg);
        const statusMsg = JSON.parse(msg.content.toString());
        try {
            await this.processMessage(statusMsg);
            // The message has been accepted.
            this.channel.ack(msg);
        } catch (err) {
            // Error creating entity or sending to queue
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

module.exports = new StatusQueueService();
