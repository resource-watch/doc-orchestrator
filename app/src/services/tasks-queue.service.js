const logger = require('logger');
const QueueService = require('services/queue.service');
const TaskService = require('services/task.service');
const DatasetService = require('services/dataset.service');
const { task, execution } = require('rw-doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const config = require('config');
const { DATASET_STATUS } = require('app.constants');

class TasksQueueService extends QueueService {

    constructor() {
        super(config.get('queues.tasks'), true);
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
            case task.MESSAGE_TYPES.TASK_APPEND:
                executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_APPEND, this.taskMsg);
                break;
            case task.MESSAGE_TYPES.TASK_DELETE:
                executorTaskMessage = execution.createMessage(execution.MESSAGE_TYPES.EXECUTION_DELETE, this.taskMsg);
                break;
            case task.MESSAGE_TYPES.TASK_OVERWRITE:
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
        logger.info(`Message received in ${config.get('queues.tasks')}`);
        this.taskMsg = JSON.parse(msg.content.toString());

        // check if any task is currently running for this dataset
        const runningTasks = await TaskService.getRunningTasks(this.taskMsg.datasetId);
        if (runningTasks.length > 0) {
            const runningTaskIds = runningTasks.map(task => task.id).join(', ');

            await DatasetService.update(this.taskMsg.datasetId, {
                status: DATASET_STATUS.SAVED,
                errorMessage: `Task(s) ${runningTaskIds} already running, operation cancelled.`
            });

            await this.channel.ack(msg);

            return;
        }

        try {
            // Create mongo task entity
            this.task = await TaskService.create(this.taskMsg);
            // Update dataset
            await DatasetService.update(this.task.datasetId, {
                taskId: `/v1/doc-importer/task/${this.task._id}`,
                errorMessage: ''
            });
            // Process message
            await this.processMessage();
            // All OK -> msg sent, so ack emitted
            await this.channel.ack(msg);
            logger.debug(`${config.get('queues.tasks')} queue message acknowledged`);
        } catch (err) {
            // Error creating entity or sending to queue
            logger.error(err);
            // Accept the message
            await this.channel.ack(msg);
            // Delete mongo task entity
            await TaskService.delete(this.task._id);
            // Update DatasetService
            await DatasetService.update(this.taskMsg.datasetId, {
                taskId: ''
            });
            const retries = msg.properties.headers['x-redelivered-count'] || 0;
            if (retries < 10) {
                this.returnMsg(msg);
            }
        }
    }

}

module.exports = new TasksQueueService();
