const logger = require('logger');
const QueueService = require('services/queue.service');
const TaskService = require('services/task.service');
const DatasetService = require('services/dataset.service');
const TaskAlreadyRunningError = require('errors/task-already-running.error');
const { task, execution } = require('rw-doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const config = require('config');

class TasksQueueService extends QueueService {

    constructor() {
        super(config.get('queues.docTasks'), true);
        this.taskMsg = {};
        this.task = {};
    }

    async processMessage() {
        // Create the message
        let executorTaskMessage;
        // Adding taskId
        this.taskMsg.taskId = this.taskMsg.id;
        switch (this.taskMsg.type) {

        case task.MESSAGE_TYPES.TASK_CREATE:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CREATE, this.taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_CONCAT:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CONCAT, this.taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_DELETE:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE, this.taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_OVERWRITE:
            // first step is creating the index, then we will catch the WRITTEN_DATA to delete the previous INDEX
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_CREATE, this.taskMsg);
            break;
        case task.MESSAGE_TYPES.TASK_DELETE_INDEX:
            executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, this.taskMsg);
            break;
        default:
            logger.info('Default');

        }
        await ExecutorTaskQueueService.sendMessage(executorTaskMessage);

    }

    async consume(msg) {
        logger.info(`Message received in ${config.get('queues.docTasks')}`);
        this.taskMsg = JSON.parse(msg.content.toString());
        try {
            // check if any task is currently running for this dataset
            await TaskService.checkRunningTasks(this.taskMsg.datasetId);
            // Create mongo task entity
            this.task = await TaskService.create(this.taskMsg);
            // Update dataset
            await DatasetService.update(this.task.datasetId, {
                taskId: `/v1/doc-importer/task/${this.task._id}`
            });
            // Process message
            await this.processMessage();
            // All OK -> msg sent, so ack emitted
            await this.channel.ack(msg);
            logger.debug(`${config.get('queues.docTasks')} queue message acknowledged`);
        } catch (err) {
            // Error creating entity or sending to queue
            logger.error(err);
            // Accept the message
            this.channel.ack(msg);
            // Delete mongo task entity
            await TaskService.delete(this.task._id);
            // Update DatasetService
            await DatasetService.update(this.task.datasetId, {
                taskId: ''
            });
            // check if rejected because it's already running a task with the same datasetId
            // in these cases we do not count
            if (err instanceof TaskAlreadyRunningError) {
                this.returnMsg(msg);
            } else {
                const retries = msg.properties.headers['x-redelivered-count'] || 0;
                if (retries < 10) {
                    this.returnMsg(msg);
                }
            }
        }
    }

}

module.exports = new TasksQueueService();
