const QueueService = require('services/queue.service');
const { EXECUTOR_TASK_QUEUE } = require('app.constants');

class ExecutorTaskQueueService extends QueueService {

    constructor() {
        super(EXECUTOR_TASK_QUEUE);
    }

}

module.exports = new ExecutorTaskQueueService();
