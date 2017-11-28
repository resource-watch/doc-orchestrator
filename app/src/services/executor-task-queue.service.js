const logger = require('logger');
const QueueService = require('services/queue.service');
const { EXECUTOR_TASK_QUEUE } = require('app.constants');

class ExecutorTaskQueueService extends QueueService {

    constructor() {
        super(EXECUTOR_TASK_QUEUE);
    }

    async sendMessage(msg) {
        logger.info(`Sending message to ${this.q}`, msg);
        try {
            // Sending to queue
            this.channel.sendToQueue(this.q, Buffer.from(JSON.stringify(msg)));
        } catch (err) {
            logger.error(`Error sending message to ${this.q}`);
            throw err;
        }
    }

}

module.exports = new ExecutorTaskQueueService();
