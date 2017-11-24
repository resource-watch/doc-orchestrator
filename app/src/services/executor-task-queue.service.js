const logger = require('logger');
const config = require('config');
const amqp = require('amqplib');
const { EXECUTOR_TASK_QUEUE } = require('app.constants');

class ExecutorTaskQueueService {

    constructor() {
        this.q = EXECUTOR_TASK_QUEUE;
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
        this.channel = await conn.createChannel();
        await this.channel.assertQueue(this.q, { durable: true });
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
