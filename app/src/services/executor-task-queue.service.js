const logger = require('logger');
const config = require('config');
const amqp = require('amqplib/callback_api');
const { promisify } = require('util');
const { EXECUTOR_TASK_QUEUE } = require('app.constants');


class ExecutorTaskQueueService {

    constructor() {
        logger.info(`Connecting to queue ${EXECUTOR_TASK_QUEUE}`);
        amqp.connect(config.get('rabbitmq.url'), (err, conn) => {
            if (err) {
                logger.error(err);
                process.exit(1);
            }
            conn.createConfirmChannel((err, ch) => {
                if (err) {
                    logger.error(err);
                    process.exit(1);
                }
                this.channel = ch;
                this.channel.assertQueueAsync = promisify(this.channel.assertQueue);
            });
        });
    }

    async sendMessage(msg) {
        try {
            logger.info('Sending message', msg);
            const data = await this.channel.assertQueueAsync(EXECUTOR_TASK_QUEUE, {
                durable: true
            });
            this.channel.sendToQueue(EXECUTOR_TASK_QUEUE, Buffer.from(JSON.stringify(msg)));
        } catch (err) {
            logger.error('Error sending message');
            throw err;
        }
    }


}

module.exports = new ExecutorTaskQueueService();
