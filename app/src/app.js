const logger = require('logger');
const config = require('config');
const Koa = require('koa');
const koaLogger = require('koa-logger');
const loader = require('loader');
const ErrorSerializer = require('serializers/error.serializer');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const mongoose = require('mongoose');
const mongoUri = process.env.MONGO_URI || `mongodb://${config.get('mongodb.host')}:${config.get('mongodb.port')}/${config.get('mongodb.database')}`;

const koaBody = require('koa-body')({
    multipart: true,
    jsonLimit: '50mb',
    formLimit: '50mb',
    textLimit: '50mb'
});

async function init() {
    return new Promise((resolve, reject) => {
        async function onDbReady(err) {

            if (err) {
                logger.error('MongoURI', mongoUri);
                logger.error(err);
                reject(new Error(err));
            }

            logger.info('Initializing doc-orchestrator');
            require('services/tasks-queue.service');
            require('services/status-queue.service');

            const app = new Koa();

            app.use(koaBody);

            app.use(async (ctx, next) => {
                try {
                    await next();
                } catch (inErr) {
                    let error = inErr;
                    try {
                        error = JSON.parse(inErr);
                    } catch (e) {
                        logger.error('Parsing error');
                        error = inErr;
                    }
                    ctx.status = error.status || ctx.status || 500;
                    logger.error(error);
                    ctx.body = ErrorSerializer.serializeError(ctx.status, error.message);
                    if (process.env.NODE_ENV === 'prod' && ctx.status === 500) {
                        ctx.body = 'Unexpected error';
                    }
                    ctx.response.type = 'application/vnd.api+json';
                }
            });

            app.use(koaLogger());
            loader.loadRoutes(app);

            const server = app.listen(process.env.PORT, () => {
                ctRegisterMicroservice.register({
                    info: require('../microservice/register.json'),
                    swagger: require('../microservice/public-swagger.json'),
                    mode: (process.env.CT_REGISTER_MODE && process.env.CT_REGISTER_MODE === 'auto') ? ctRegisterMicroservice.MODE_AUTOREGISTER : ctRegisterMicroservice.MODE_NORMAL,
                    framework: ctRegisterMicroservice.KOA2,
                    app,
                    logger,
                    name: config.get('service.name'),
                    ctUrl: process.env.CT_URL,
                    url: process.env.LOCAL_URL,
                    token: process.env.CT_TOKEN,
                    active: true
                }).then(() => {}, (error) => {
                    logger.error(error);
                    process.exit(1);
                });
            });
            logger.info('Server started in ', process.env.PORT);
            resolve({ app, server });
        }

        logger.info(`Connecting to MongoDB URL ${mongoUri}`);
        mongoose.connect(mongoUri, onDbReady);
    });
}

module.exports = init;
