const logger = require('logger');
const config = require('config');
const Koa = require('koa');
const koaLogger = require('koa-logger');
const loader = require('loader');
const sleep = require('sleep');
const ErrorSerializer = require('serializers/error.serializer');
const { RWAPIMicroservice } = require('rw-api-microservice-node');
const mongoose = require('mongoose');
const koaSimpleHealthCheck = require('koa-simple-healthcheck');
const koaBody = require('koa-body');

const mongooseOptions = require('../../config/mongoose');

// const nock = require('nock');
// nock.recorder.rec();

const mongoUri = process.env.MONGO_URI || `mongodb://${config.get('mongodb.host')}:${config.get('mongodb.port')}/${config.get('mongodb.database')}`;

let retries = 10;

async function init() {
    return new Promise((resolve, reject) => {
        async function onDbReady(err) {
            if (err) {
                if (retries >= 0) {
                    retries -= 1;
                    logger.error(`Failed to connect to MongoDB uri ${mongoUri}, retrying...`);
                    sleep.sleep(5);
                    mongoose.connect(mongoUri, { useNewUrlParser: true }, onDbReady);
                } else {
                    logger.error('MongoURI', mongoUri);
                    logger.error(err);
                    reject(new Error(err));
                }

                return;
            }

            logger.info('Initializing doc-orchestrator');
            require('services/tasks-queue.service');
            require('services/status-queue.service');

            const app = new Koa();

            app.use(koaBody({
                multipart: true,
                jsonLimit: '50mb',
                formLimit: '50mb',
                textLimit: '50mb'
            }));

            app.use(async (ctx, next) => {
                try {
                    await next();
                } catch (inErr) {
                    let error = inErr;
                    try {
                        error = JSON.parse(inErr);
                    } catch (e) {
                        logger.debug('Could not JSON parse exception - is it JSON?');
                        error = inErr;
                    }
                    ctx.status = error.status || ctx.status || 500;
                    if (ctx.status >= 500) {
                        logger.error(error);
                    } else {
                        logger.info(error);
                    }
                    ctx.body = ErrorSerializer.serializeError(ctx.status, error.message);
                    if (process.env.NODE_ENV === 'prod' && ctx.status === 500) {
                        ctx.body = 'Unexpected error';
                    }
                    ctx.response.type = 'application/vnd.api+json';
                }
            });

            app.use(koaLogger());
            app.use(koaSimpleHealthCheck());

            app.use(RWAPIMicroservice.bootstrap({
                name: config.get('service.name'),
                info: require('../microservice/register.json'),
                swagger: require('../microservice/public-swagger.json'),
                logger,
                baseURL: process.env.CT_URL,
                url: process.env.LOCAL_URL,
                token: process.env.CT_TOKEN,
            }));

            loader.loadRoutes(app);

            const server = app.listen(process.env.PORT, () => {
                if (process.env.CT_REGISTER_MODE === 'auto') {
                    RWAPIMicroservice.register().then(() => {
                        logger.info('CT registration process started');
                    }, (error) => {
                        logger.error(error);
                        process.exit(1);
                    });
                }
            });

            logger.info('Server started in ', process.env.PORT);
            resolve({ app, server });
        }

        logger.info(`Connecting to MongoDB URL ${mongoUri}`);
        mongoose.connect(mongoUri, mongooseOptions, onDbReady);
    });
}

module.exports = init;
