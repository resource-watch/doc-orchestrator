const logger = require('logger');
const amqp = require('amqplib/callback_api');

const { TASKS_QUEUE } = require('app.constants');

class TasksQueueService {

    constructor() {
        amqp.connect(process.env.RABBITMQ_URL, (e, conn) => {
            if (e) {
                logger.error(e);
                return;
            }
            conn.createChannel((err, ch) => {
                const q = TASKS_QUEUE;
                ch.assertQueue(q, {
                    durable: true,
                    maxLength: 10
                });
                ch.prefetch(1);
                // Note: on Node 6 Buffer.from(msg) should be used
                logger.debug(` [*] Waiting for messages (pid ${process.pid}) in ${q}. To exit press CTRL+C`, q);
                ch.consume(q, (msg) => {
                    logger.debug(`${process.pid} [x] Received `);
                    ch.ack(msg);
                    logger.debug('sending ack');
                }, {
                    noAck: false
                });
            });
        });
    }

}

module.exports = TasksQueueService;
