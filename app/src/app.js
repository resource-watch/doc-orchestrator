const logger = require('logger');
const config = require('config');
const mongoose = require('mongoose');
const mongoUri = process.env.MONGO_URI || `mongodb://${config.get('mongodb.host')}:${config.get('mongodb.port')}/${config.get('mongodb.database')}`;

const onDbReady = (err) => {

    if (err) {
        logger.error('MongoURI', mongoUri);
        logger.error(err);
        throw new Error(err);
    }

    logger.info('Initializing doc-orchestrator');
    require('services/tasks-queue.service');
    require('services/status-queue.service');
    require('services/executor-task-queue.service');
};

mongoose.connect(mongoUri, onDbReady);
