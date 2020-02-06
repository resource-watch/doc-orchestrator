const logger = require('logger');
const config = require('config');
const amqp = require('amqplib');
const RabbitMQConnectionError = require('errors/rabbitmq-connection.error');
const sleep = require('sleep');

let connectAttempts = 10;

class QueueService {

    constructor(q, consume = false) {
        this.q = q;
        logger.debug(`Connecting to queue ${this.q}`);
        try {
            this.init(consume).then(() => {
                logger.debug('Connected');
            }, (err) => {
                logger.error(err);
                process.exit(1);
            });
        } catch (err) {
            logger.error(err);
        }
    }

    async init(consume) {
        let conn = null;
        while (connectAttempts >= 0 && conn === null) {
            try {
                // eslint-disable-next-line no-await-in-loop
                conn = await amqp.connect(config.get('rabbitmq.url'));
            } catch (err) {
                logger.debug(`Failure connection to RabbitMQ on ${config.get('rabbitmq.url')}, ${connectAttempts} reconnect attempts remaining`);
                // eslint-disable-next-line no-plusplus
                connectAttempts--;
                await sleep.sleep(5);
            }
        }
        if (!conn) {
            logger.error(`Could not connect to RabbitMQ, giving up`);
            throw new RabbitMQConnectionError();
        }
        this.channel = await conn.createConfirmChannel();
        await this.channel.assertQueue(this.q, { durable: true });
        if (consume) {
            this.channel.prefetch(1);
            logger.debug(` [*] Waiting for messages in ${this.q}`);
            this.channel.consume(this.q, this.consume.bind(this), {
                noAck: false
            });
        }
    }

    async returnMsg(msg) {
        logger.debug(`Sending message to ${this.q}`);
        try {
            // Sending to queue
            let count = msg.properties.headers['x-redelivered-count'] || 0;
            count += 1;
            this.channel.sendToQueue(this.q, msg.content, { headers: { 'x-redelivered-count': count } });
        } catch (err) {
            logger.error(`Error sending message to ${this.q}`);
            throw err;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    consume() {
    }

}

module.exports = QueueService;
