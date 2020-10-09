const logger = require('logger');
const QueueService = require('services/queue.service');
const TaskService = require('services/task.service');
const DatasetService = require('services/dataset.service');
const { execution, status, task } = require('rw-doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const config = require('config');
const { TASK_STATUS, DATASET_STATUS } = require('app.constants');
const {
    get, concat, compact, uniq
} = require('lodash');

class StatusQueueService extends QueueService {

    constructor() {
        super(config.get('queues.status'), true);
        this.statusMsg = {};
        this.currentTask = {};
    }

    async sendExecutionTask(type, taskProps, props = {}) {
        let contentMsg = {
            taskId: this.currentTask._id
        };
        this.currentTask = await TaskService.get(this.statusMsg.taskId);
        taskProps.forEach((prop) => {
            const field = Object.keys(prop)[0];
            contentMsg[field] = get(this.currentTask, prop[field]);
        });

        contentMsg = {
            ...contentMsg,
            ...props
        };

        const message = execution.createMessage(type, contentMsg);
        await ExecutorTaskQueueService.sendMessage(message);
    }

    async indexCreated() {
        const dataset = await DatasetService.get(this.currentTask.datasetId);
        const { connectorUrl, sources } = dataset.data.attributes;

        const datasetProps = {
            status: DATASET_STATUS.PENDING
        };

        switch (this.currentTask.type) {

            case task.MESSAGE_TYPES.TASK_CREATE:
                datasetProps.tableName = this.statusMsg.index;
                datasetProps.sources = this.currentTask.message.fileUrl;

                break;
            case task.MESSAGE_TYPES.TASK_OVERWRITE:
                if (this.currentTask.index && (this.currentTask.index !== this.statusMsg.index)) {
                    await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'index' }]);
                    await TaskService.resetCounters(this.currentTask._id);
                }

                datasetProps.tableName = this.statusMsg.index;
                datasetProps.sources = this.currentTask.message.fileUrl;

                break;
            case task.MESSAGE_TYPES.TASK_CONCAT:
                if (this.currentTask.index && (this.currentTask.index !== this.statusMsg.index)) {
                    await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'index' }]);
                    await TaskService.resetCounters(this.currentTask._id);
                }

                datasetProps.sources = uniq(compact(concat([], connectorUrl, sources, this.currentTask.message.fileUrl)));

                break;
            case task.MESSAGE_TYPES.TASK_REINDEX:
                await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_REINDEX, [{ sourceIndex: 'message.index' }], { targetIndex: this.statusMsg.index });

                break;

            default:
                break;

        }

        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.INDEX_CREATED,
            index: this.statusMsg.index
        });

        await DatasetService.update(this.currentTask.datasetId, datasetProps);
    }

    async indexDeactivated() {
        if ((this.currentTask.index) && (this.currentTask.index !== this.statusMsg.index)) {
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'index' }]);
            await TaskService.resetCounters(this.currentTask._id);
        }
        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.INDEX_CREATED,
            index: this.statusMsg.index
        });
        await DatasetService.update(this.currentTask.datasetId, { status: DATASET_STATUS.PENDING });
    }

    async readData() {
        // Executor says that it's read a piece of data
        await TaskService.addRead(this.currentTask._id);
    }

    async blockchainGenerated() {
        await DatasetService.update(this.currentTask.datasetId, {
            blockchain: this.statusMsg.blockchain
        });
    }

    async readFile() {
        // The file has been read completely, just update the status
        const currentTask = await TaskService.get(this.currentTask._id);

        const updatedTask = await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.READ,
            filesProcessed: currentTask.filesProcessed += 1
        });

        const finished = await TaskService.checkCounter(updatedTask);
        if (finished) {
            // Sending confirm index creation
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT, [{ index: 'index' }]);
        }
    }

    async writtenData() {
        // add write +1
        const currentTask = await TaskService.addWrite(this.statusMsg.taskId);
        // AND NOW CHECK IF WRITES-READS == 0 and TASK_STATUS == READ
        const finished = await TaskService.checkCounter(currentTask);
        if (finished) {
            // Sending confirm index creation
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT, [{ index: 'index' }]);
        }
    }

    async indexDeleted() {
        if (
            this.currentTask.type === task.MESSAGE_TYPES.TASK_OVERWRITE
            || this.currentTask.type === task.MESSAGE_TYPES.TASK_DELETE_INDEX
            || this.currentTask.type === task.MESSAGE_TYPES.TASK_CONCAT
        ) {
            // it comes from a DELETE INDEX, OVERWRITE TASK or CONCAT TASK
            await TaskService.update(this.currentTask._id, {
                status: TASK_STATUS.INDEX_DELETED
            });
            await TaskService.update(this.currentTask._id, {
                status: TASK_STATUS.SAVED
            });
            await DatasetService.update(this.currentTask.datasetId, {
                status: DATASET_STATUS.SAVED,
            });
        } else {
            // if it caused by an error and The index was deleted due to an error
            // ERROR!
            // do nothing?
        }
    }

    async performedDeleteQuery() {
        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.PERFORMED_DELETE_QUERY,
            elasticTaskId: this.statusMsg.elasticTaskId
        });
        await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_DELETE, [{ elasticTaskId: 'elasticTaskId' }]);
    }

    async finishedDeleteQuery() {
        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.FINISHED_DELETE_QUERY
        });
        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.SAVED
        });
        await DatasetService.update(this.currentTask.datasetId, {
            status: DATASET_STATUS.SAVED,
        });
    }

    async importConfirmed() {
        switch (this.currentTask.type) {

            case task.MESSAGE_TYPES.TASK_OVERWRITE:
                await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'message.index' }]);
                break;
            case task.MESSAGE_TYPES.TASK_CONCAT:
                await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_REINDEX, [{ sourceIndex: 'message.index' }, { targetIndex: 'index' }]);
                break;
            case task.MESSAGE_TYPES.TASK_APPEND: {
                const dataset = await DatasetService.get(this.currentTask.datasetId);
                const { connectorUrl, sources } = dataset.data.attributes;

                await TaskService.update(this.currentTask._id, {
                    status: TASK_STATUS.SAVED
                });
                await DatasetService.update(this.currentTask.datasetId, {
                    status: DATASET_STATUS.SAVED,
                    connectorUrl: null,
                    sources: uniq(compact(concat([], connectorUrl, sources, this.currentTask.message.fileUrl)))
                });
                break;
            }
            default:
                await TaskService.update(this.currentTask._id, {
                    status: TASK_STATUS.SAVED
                });
                await DatasetService.update(this.currentTask.datasetId, {
                    status: DATASET_STATUS.SAVED
                });
                break;

        }
    }

    async performedReindex() {
        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.PERFORMED_REINDEX,
            elasticTaskId: this.statusMsg.elasticTaskId
        });
        await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_REINDEX, [{ elasticTaskId: 'elasticTaskId' }, { filesProcessed: 'message.fileUrl.length' }]);
    }

    async finishedReindex() {
        const dataset = await DatasetService.get(this.currentTask.datasetId);
        const { connectorUrl, sources } = dataset.data.attributes;

        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.SAVED
        });

        const calculatedSources = uniq(compact(concat([], connectorUrl, sources, this.currentTask.message.fileUrl)));
        const datasetPayload = {
            status: DATASET_STATUS.SAVED,
            tableName: this.currentTask.index
        };

        if (calculatedSources.length > 0) {
            datasetPayload.connectorUrl = null;
            datasetPayload.sources = calculatedSources;
        }

        await DatasetService.update(this.currentTask.datasetId, datasetPayload);
        await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'message.index' }]);
    }

    async error() {
        await TaskService.update(this.currentTask._id, {
            status: TASK_STATUS.ERROR,
            error: this.statusMsg.error
        });
        await DatasetService.update(this.currentTask.datasetId, {
            status: DATASET_STATUS.ERROR,
            errorMessage: this.statusMsg.error
        });
    }

    async processMessage() {

        switch (this.statusMsg.type) {

            case status.MESSAGE_TYPES.STATUS_INDEX_DEACTIVATED:
                await this.indexDeactivated();
                break;
            case status.MESSAGE_TYPES.STATUS_INDEX_CREATED:
                await this.indexCreated();
                break;
            case status.MESSAGE_TYPES.STATUS_READ_DATA:
                await this.readData();
                break;
            case status.MESSAGE_TYPES.STATUS_BLOCKCHAIN_GENERATED:
                await this.blockchainGenerated();
                break;
            case status.MESSAGE_TYPES.STATUS_READ_FILE:
                await this.readFile();
                break;
            case status.MESSAGE_TYPES.STATUS_WRITTEN_DATA:
                await this.writtenData();
                break;
            case status.MESSAGE_TYPES.STATUS_INDEX_DELETED:
                await this.indexDeleted();
                break;
            case status.MESSAGE_TYPES.STATUS_PERFORMED_DELETE_QUERY:
                await this.performedDeleteQuery();
                break;
            case status.MESSAGE_TYPES.STATUS_FINISHED_DELETE_QUERY:
                await this.finishedDeleteQuery();
                break;
            case status.MESSAGE_TYPES.STATUS_PERFORMED_REINDEX:
                await this.performedReindex();
                break;
            case status.MESSAGE_TYPES.STATUS_FINISHED_REINDEX:
                await this.finishedReindex();
                break;
            case status.MESSAGE_TYPES.STATUS_IMPORT_CONFIRMED:
                await this.importConfirmed();
                break;
            case status.MESSAGE_TYPES.STATUS_ERROR:
                await this.error();
                break;
            default:
                logger.error(`Status message type not valid: ${this.statusMsg.type}`);

        }
    }

    async consume(msg) {
        logger.debug('Message received in DOC-STATUS');
        try {
            this.statusMsg = JSON.parse(msg.content.toString());
            // update just logs and get the entity at the same time
            this.currentTask = await TaskService.update(this.statusMsg.taskId, { log: this.statusMsg });
            await this.processMessage();
            // The message has been accepted.
            this.channel.ack(msg);
            logger.debug('Status Message accepted');
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
