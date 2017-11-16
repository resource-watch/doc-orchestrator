const logger = require('logger');
const config = require('config');
const amqp = require('amqplib/callback_api');
const { TASKS_QUEUE } = require('app.constants');

class TasksQueueService {

    constructor() {
        logger.info(`Connecting to queue ${TASKS_QUEUE}`);
        amqp.connect(config.get('rabbitmq.url'), (err, conn) => {
            if (err) {
                logger.error(err);
                process.exit(1);
            }
            conn.createChannel((err, ch) => {
                const q = TASKS_QUEUE;
                this.channel = ch;
                ch.assertQueue(q, {
                    durable: true,
                    maxLength: 10
                });
                ch.prefetch(1);

                logger.info(` [*] Waiting for messages in ${q}`);
                ch.consume(q, this.consume.bind(this), {
                    noAck: false
                });
            });
        });
    }

    async consume(msg) {
        logger.info('Message received', msg);

    }

}

module.exports = new TasksQueueService();
