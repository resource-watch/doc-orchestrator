const logger = require('logger');
const QueueService = require('services/queue.service');
const TaskService = require('services/task.service');
const DatasetService = require('services/dataset.service');
const { execution, status, task } = require('rw-doc-importer-messages');
const ExecutorTaskQueueService = require('services/executor-task-queue.service');
const { STATUS_QUEUE } = require('app.constants');
const STATUS = require('app.constants').STATUS;

class StatusQueueService extends QueueService {

    constructor() {
        super(STATUS_QUEUE, true);
        this.statusMsg = {};
        this.currentTask = {};
    }

    async sendExecutionTask(type, props) {
        const contentMsg = {
            taskId: this.currentTask._id
        };
        this.currentTask = await TaskService.get(this.statusMsg.taskId);
        props.forEach(prop => {
            const field = Object.keys(prop)[0];
            const dbField = prop[field];
            // message prop cases
            if (dbField.indexOf('.') >= 0) {
                contentMsg[field] = this.currentTask[dbField.split('.')[0]][dbField.split('.')[1]];
            } else {
                contentMsg[field] = this.currentTask[dbField];
            }
        });
        const message = execution.createMessage(type, contentMsg);
        await ExecutorTaskQueueService.sendMessage(message);
    }

    async indexCreated() {
        if ((this.currentTask.index) && (this.currentTask.index !== this.statusMsg.index)) {
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'index' }]);
            await TaskService.resetCounters(this.currentTask._id);
        }
        await TaskService.update(this.currentTask._id, {
            status: STATUS.INDEX_CREATED,
            index: this.statusMsg.index
        });
        // update the dataset
        const datasetProps = {
            status: STATUS.INDEX_CREATED,
        };
        if (this.currentTask.type !== task.MESSAGE_TYPES.TASK_CONCAT) {
            datasetProps.tableName = this.statusMsg.index;
        }
        await DatasetService.update(this.currentTask.datasetId, datasetProps);
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
        await TaskService.update(this.currentTask._id, {
            status: STATUS.READ
        });
        const finished = await TaskService.checkCounter(this.statusMsg.taskId);
        if (finished) {
            // Sending confirm index creation
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT, [{ index: 'index' }]);
        }
    }

    async writtenData() {
        // add write +1
        await TaskService.addWrite(this.statusMsg.taskId);
        // AND NOW CHECK IF WRITES-READS == 0 and STATUS == READ
        const finished = await TaskService.checkCounter(this.statusMsg.taskId);
        if (finished) {
            // Sending confirm index creation
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT, [{ index: 'index' }]);
        }
    }

    async indexDeleted() {
        if ((this.currentTask.type === task.MESSAGE_TYPES.TASK_OVERWRITE) || (this.currentTask.type === task.MESSAGE_TYPES.TASK_DELETE_INDEX) || (this.currentTask.type === task.MESSAGE_TYPES.TASK_CONCAT)) {
            // it comes from a DELETE INDEX, OVERWRITE TASK or CONCAT TASK
            await TaskService.update(this.currentTask._id, {
                status: STATUS.INDEX_DELETED
            });
            await TaskService.update(this.currentTask._id, {
                status: STATUS.SAVED
            });
            await DatasetService.update(this.currentTask.datasetId, {
                status: STATUS.SAVED,
            });
        } else {
            // if it caused by an error and The index was deleted due to an error
            // ERROR!
            // do nothing?
        }
    }

    async performedDeleteQuery() {
        await TaskService.update(this.currentTask._id, {
            status: STATUS.PERFORMED_DELETE_QUERY,
            elasticTaskId: this.statusMsg.elasticTaskId
        });
        await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_DELETE, [{ elasticTaskId: 'elasticTaskId' }]);
    }

    async finishedDeleteQuery() {
        await TaskService.update(this.currentTask._id, {
            status: STATUS.FINISHED_DELETE_QUERY
        });
        await TaskService.update(this.currentTask._id, {
            status: STATUS.SAVED
        });
        await DatasetService.update(this.currentTask.datasetId, {
            status: STATUS.SAVED,
        });
    }

    async importConfirmed() {
        // it comes from overwrite
        if (this.currentTask.type === task.MESSAGE_TYPES.TASK_OVERWRITE) {
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'message.index' }]);
        } else if (this.currentTask.type === task.MESSAGE_TYPES.TASK_CONCAT) {
            await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_REINDEX, [{ sourceIndex: 'index' }, { targetIndex: 'message.index' }]);
        } else {
            await TaskService.update(this.currentTask._id, {
                status: STATUS.SAVED
            });
            await DatasetService.update(this.currentTask.datasetId, {
                status: STATUS.SAVED,
            });
        }
    }

    async performedReindex() {
        await TaskService.update(this.currentTask._id, {
            status: STATUS.PERFORMED_REINDEX,
            elasticTaskId: this.statusMsg.elasticTaskId
        });
        await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_REINDEX, [{ elasticTaskId: 'elasticTaskId' }]);
    }

    async finishedReindex() {
        await TaskService.update(this.currentTask._id, {
            status: STATUS.FINISHED_REINDEX
        });
        await DatasetService.update(this.currentTask.datasetId, {
            status: STATUS.FINISHED_REINDEX,
        });
        await this.sendExecutionTask(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX, [{ index: 'index' }]);
    }

    async error() {
        await TaskService.update(this.currentTask._id, {
            status: STATUS.ERROR,
            error: this.statusMsg.error
        });
        await DatasetService.update(this.currentTask.datasetId, {
            status: STATUS.ERROR,
        });
    }

    async processMessage() {

        switch (this.statusMsg.type) {

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
            logger.error('Status Message Type not valid');

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
