class RabbitMQConnection extends Error {

    constructor(message) {
        super(message);
        this.name = 'RabbitMQConnection';
        this.message = message;
    }

}

module.exports = RabbitMQConnection;
