const logger = require('logger');
const config = require('config');
const Koa = require('koa');
const koaLogger = require('koa-logger');
const loader = require('loader');
const ErrorSerializer = require('serializers/error.serializer');
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

    // const app = new Koa();
    //
    // app.use(async (ctx, next) => {
    //     try {
    //         await next();
    //     } catch (inErr) {
    //         let error = inErr;
    //         try {
    //             error = JSON.parse(inErr);
    //         } catch (e) {
    //             logger.error('Parsing error');
    //             error = inErr;
    //         }
    //         ctx.status = error.status || ctx.status || 500;
    //         logger.error(error);
    //         ctx.body = ErrorSerializer.serializeError(ctx.status, error.message);
    //         if (process.env.NODE_ENV === 'prod' && ctx.status === 500) {
    //             ctx.body = 'Unexpected error';
    //         }
    //         ctx.response.type = 'application/vnd.api+json';
    //     }
    // });
    //
    // app.use(koaLogger());
    //
    // loader.loadRoutes(app);
};

mongoose.connect(mongoUri, onDbReady);
process.on('exit', () => {
    logger.error('Error');
});
