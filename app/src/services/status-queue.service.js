const logger = require('logger');
const config = require('config');
const amqp = require('amqplib/callback_api');
const TaskService = require('services/task.service');
const { status } = require('doc-importer-messages');
const { STATUS_QUEUE } = require('app.constants');
const STATUS = require('app.constants').STATUS;

class StatusQueueService {

    constructor() {
        logger.info(`Connecting to queue ${STATUS_QUEUE}`);
        amqp.connect(config.get('rabbitmq.url'), (err, conn) => {
            if (err) {
                logger.error(err);
                process.exit(1);
            }
            conn.createChannel((err, ch) => {
                const q = STATUS_QUEUE;
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
        const statusMsg = JSON.parse(msg.content.toString());
        try {
            switch (statusMsg.type) {

            case status.MESSAGE_TYPES.STATUS_READ:
                await TaskService.addRead(status.taskId);
                break;
            case status.MESSAGE_TYPES.STATUS_WRITE:
                await TaskService.addWrite(status.taskId);
                break;
            case status.MESSAGE_TYPES.START_READING:
                await TaskService.updateStatus(status.taskId, STATUS.start_reading);
                break;
            case status.MESSAGE_TYPES.FINISH_READING:
                await TaskService.updateStatus(status.taskId, STATUS.finish_reading);
                break;
            case status.MESSAGE_TYPES.STATUS_CHECK_DELETE:
                // @TODO
                break;
            case status.MESSAGE_TYPES.DELETED_INDEX:
                // @TODO we gotta add this msg type
                // We always update the entity and after that we will check the status and
                // do whatever we need to do
                await TaskService.updateStatus(status.taskId, STATUS.deleted_index);
                break;
            default:
                logger.info('do nothing?');

            }
            // The message has been accepted.
            this.channel.ack(msg);
            // Now we still need to trigger something.
            await TaskService.next(status.taskId);
        } catch (err) {
            // Error creating entity or sending to queue
            logger.error(err);
            const retries = msg.fields.deliveryTag;
            if (retries < 1000) {
                this.channel.nack(msg);
            } else {
                this.channel.ack(msg);
            }
        }
    }

}

module.exports = new StatusQueueService();
