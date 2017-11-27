const logger = require('logger');
const config = require('config');
const amqp = require('amqplib');
const TaskService = require('services/task.service');
const DatasetService = require('services/dataset.service');
const { execution, status, task } = require('doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const { STATUS_QUEUE } = require('app.constants');
const STATUS = require('app.constants').STATUS;

class StatusQueueService {

    constructor() {
        this.q = STATUS_QUEUE;
        logger.info(`Connecting to queue ${this.q}`);
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
        await this.channel.assertQueue(this.q, { durable: true });
        this.channel.prefetch(1);
        logger.info(` [*] Waiting for messages in ${this.q}`);
        this.channel.consume(this.q, this.consume.bind(this), {
            noAck: false
        });
    }

    async returnMsg(msg) {
        logger.info(`Sending message to ${this.q}`);
        try {
            // Sending to queue
            let count = msg.properties.headers['x-redelivered-count'] || 0;
            count += 1;
            this.channel.sendToQueue(this.q, msg.content, { headers: { 'x-redelivered-count': count } });
        } catch (err) {
            logger.error(`Error sending message to ${this.q}`);
            throw err;
        }
    }

    async generateExecutionTask(taskId, type, props) {
        const currentTask = await TaskService.get(taskId);
        const contentMsg = {
            taskId
        };
        props.forEach(prop => {
            // message prop cases
            if (prop.indexOf('.') >= 0) {
                contentMsg[prop.split('.')[1]] = currentTask.prop[prop.split('.')[0]][prop.split('.')[1]];
            } else {
                contentMsg[prop] = currentTask.prop;
            }
        });
        return execution.createMessage(type, contentMsg);
    }

    async processMessage(statusMsg) {

        switch (statusMsg.type) {

        case status.MESSAGE_TYPES.STATUS_INDEX_CREATED: {
            // From INIT to INDEX_CREATED
            // update the index that it's in index attribute in the message
            const currentTask = TaskService.get(statusMsg.taskId);
            if ((currentTask.index) && (currentTask.index !== statusMsg.index)) {
                const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, ['index']);
                await ExecutorTaskQueueService.sendMessage(message);
            }
            await TaskService.updateStatus(statusMsg.taskId, STATUS.INDEX_CREATED);
            await TaskService.updateIndex(statusMsg.taskId, statusMsg.index);
            await DatasetService.update();
            break;
        }
        case status.MESSAGE_TYPES.STATUS_READ_DATA:
            // Executor says that it's read a piece of data
            await TaskService.addRead(statusMsg.taskId);
            break;
        case status.MESSAGE_TYPES.STATUS_READ_FILE: {
            // The file has been read completely, just update the status
            await TaskService.updateStatus(statusMsg.taskId, STATUS.READ);
            const finished = await TaskService.checkCounter(statusMsg.taskId);
            if (finished) {
                // Sending confirm index creation
                const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT, ['index']);
                await ExecutorTaskQueueService.sendMessage(message);
            }
            break;
        }
        case status.MESSAGE_TYPES.STATUS_WRITTEN_DATA: {
            // add write +1
            await TaskService.addWrite(statusMsg.taskId);
            // AND NOW CHECK IF WRITES-READS == 0 and STATUS == READ
            const finished = await TaskService.checkCounter(statusMsg.taskId);
            if (finished) {
                // Sending confirm index creation
                const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT, ['index']);
                await ExecutorTaskQueueService.sendMessage(message);
            }
            break;
        }
        case status.MESSAGE_TYPES.STATUS_INDEX_DELETED: {
            const currentTask = TaskService.get(statusMsg.taskId);
            // if it caused by an error and The index was deleted due to an error
            if ((currentTask.type !== task.MESSAGE_TYPES.TASK_OVERWRITE) && (currentTask.type !== task.MESSAGE_TYPES.TASK_DELETE_INDEX)) {
                // ERROR!
                // do nothing?
            } else {
                // it comes from a DELETE INDES OR OVERWRITE TASK
                logger.debug(`[STATUS-QUEUE-SERVICE] Received ${status.MESSAGE_TYPES.STATUS_INDEX_DELETED}`);
                await TaskService.updateStatus(statusMsg.taskId, STATUS.INDEX_DELETED);
                logger.debug('[STATUS-QUEUE-SERVICE] its a TASK_DELETE_INDEX');
                await TaskService.updateStatus(statusMsg.taskId, STATUS.SAVED);
                await DatasetService.update();
            }
            break;
        }
        case status.MESSAGE_TYPES.STATUS_PERFORMED_DELETE_QUERY: {
            await TaskService.updateStatus(statusMsg.taskId, STATUS.PERFORMED_DELETE_QUERY);
            await TaskService.updateElasticTaskId(statusMsg.taskId, statusMsg.elasticTaskId);
            const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_CONFIRM_DELETE, ['elasticTaskId']);
            await ExecutorTaskQueueService.sendMessage(message);
            break;
        }
        case status.MESSAGE_TYPES.STATUS_FINISHED_DELETE_QUERY:
            await TaskService.updateStatus(statusMsg.taskId, STATUS.FINISHED_DELETE_QUERY);
            // update dataset
            await TaskService.updateStatus(statusMsg.taskId, STATUS.SAVED);
            await DatasetService.update();
            break;
        case status.MESSAGE_TYPES.STATUS_IMPORT_CONFIRMED: {
            const currentTask = TaskService.get(statusMsg.taskId);
            // it comes from overwrite
            if (currentTask.type === task.MESSAGE_TYPES.TASK_OVERWRITE) {
                const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, ['message.index']);
                await ExecutorTaskQueueService.sendMessage(message);
            } else if (currentTask.type === task.MESSAGE_TYPES.TASK_CONCAT) {
                const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_REINDEX, ['index']);
                await ExecutorTaskQueueService.sendMessage(message);
            } else {
                await TaskService.updateStatus(statusMsg.taskId, STATUS.SAVED);
                await DatasetService.update();
            }
            break;
        }
        case status.MESSAGE_TYPES.STATUS_PERFORMED_REINDEX: {
            await TaskService.updateStatus(statusMsg.taskId, STATUS.PERFORMED_REINDEX);
            await TaskService.updateElasticTaskId(statusMsg.taskId, statusMsg.elasticTaskId);
            const message = await this.generateExecutionTask(statusMsg.taskId, execution.MESSAGE_TYPES.EXECUTION_CONFIRM_REINDEX, ['elasticTaskId']);
            await ExecutorTaskQueueService.sendMessage(message);
            break;
        }
        case status.MESSAGE_TYPES.STATUS_FINISHED_REINDEX:
            await TaskService.updateStatus(statusMsg.taskId, STATUS.FINISHED_REINDEX);
            // update dataset
            await TaskService.updateStatus(statusMsg.taskId, STATUS.SAVED);
            await DatasetService.update();
            break;
        case status.MESSAGE_TYPES.STATUS_ERROR:
            await TaskService.updateStatus(statusMsg.taskId, STATUS.ERROR);
            await TaskService.updateError(statusMsg.taskId, statusMsg.error);
            await DatasetService.update();
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
            logger.debug('msg accepted');
        } catch (err) {
            // Error creating entity or sending to queue
            logger.error(err);
            // Accept the message
            this.channel.ack(msg);
            const retries = msg.properties.headers['x-redelivered-count'] || 0;
            if (retries < 10) {
                this.returnMsg(msg);
            }
        }
    }

}

module.exports = new StatusQueueService();
