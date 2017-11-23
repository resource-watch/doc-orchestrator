const logger = require('logger');
const config = require('config');
const amqp = require('amqplib');
const { promisify } = require('util');
const { EXECUTOR_TASK_QUEUE } = require('app.constants');


class ExecutorTaskQueueService {

    constructor() {
        logger.info(`Connecting to queue ${EXECUTOR_TASK_QUEUE}`);
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
        this.channel.assertQueueAsync = promisify(this.channel.assertQueue);
    }

    async sendMessage(msg) {
        logger.info('Sending message to EXECUTOR_TASK_QUEUE', msg);
        try {
            // Sending to queue
            await this.channel.assertQueueAsync(EXECUTOR_TASK_QUEUE, { durable: true });
            this.channel.sendToQueue(EXECUTOR_TASK_QUEUE, Buffer.from(JSON.stringify(msg)));
        } catch (err) {
            logger.error('Error sending message to Executor Task Queue');
            throw err;
        }
    }


}

module.exports = new ExecutorTaskQueueService();
