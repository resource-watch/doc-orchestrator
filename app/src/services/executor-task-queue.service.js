const logger = require('logger');
const QueueService = require('services/queue.service');
const config = require('config');

class ExecutorTaskQueueService extends QueueService {

    constructor() {
        super(config.get('queues.executorTasks'), false);
    }

    async sendMessage(msg) {
        logger.info(`Sending message to ${this.q}`, msg);
        try {
            // Sending to queue
            await this.channel.sendToQueue(this.q, Buffer.from(JSON.stringify(msg)));
        } catch (err) {
            logger.error(`Error sending message to ${this.q}`);
            throw err;
        }
    }

}

module.exports = new ExecutorTaskQueueService();
