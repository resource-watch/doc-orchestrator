/* eslint-disable no-unused-vars,no-undef,no-await-in-loop */
const nock = require('nock');
const chai = require('chai');
const amqp = require('amqplib');
const config = require('config');
const appConstants = require('app.constants');
const Task = require('models/task.model');
const RabbitMQConnectionError = require('errors/rabbitmq-connection.error');
const { task, execution } = require('rw-doc-importer-messages');
const sleep = require('sleep');
const { getTestServer } = require('./test-server');
const { createTask } = require('./utils');

const should = chai.should();

let requester;
let rabbitmqConnection = null;
let channel;


nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('STATUS_IMPORT_CONFIRMED handling process', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        let connectAttempts = 10;
        while (connectAttempts >= 0 && rabbitmqConnection === null) {
            try {
                rabbitmqConnection = await amqp.connect(config.get('rabbitmq.url'));
            } catch (err) {
                connectAttempts -= 1;
                await sleep.sleep(5);
            }
        }
        if (!rabbitmqConnection) {
            throw new RabbitMQConnectionError();
        }

        channel = await rabbitmqConnection.createConfirmChannel();
        await channel.assertQueue(config.get('queues.status'));
        await channel.assertQueue(config.get('queues.tasks'));
        await channel.assertQueue(config.get('queues.executorTasks'));

        requester = await getTestServer();
    });

    beforeEach(async () => {
        await channel.purgeQueue(config.get('queues.status'));
        await channel.purgeQueue(config.get('queues.tasks'));
        await channel.purgeQueue(config.get('queues.executorTasks'));

        const statusQueueStatus = await channel.checkQueue(config.get('queues.status'));
        statusQueueStatus.messageCount.should.equal(0);

        const tasksQueueStatus = await channel.checkQueue(config.get('queues.tasks'));
        tasksQueueStatus.messageCount.should.equal(0);

        const executorTasksQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorTasksQueueStatus.messageCount.should.equal(0);

        Task.remove({}).exec();
    });

    it('Consume a STATUS_IMPORT_CONFIRMED message for a TASK_CREATE task should set task and dataset statuses to saved (happy case)', async () => {
        const fakeTask1 = await new Task(createTask(appConstants.TASK_STATUS.INIT, task.MESSAGE_TYPES.TASK_CREATE)).save();

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${fakeTask1.datasetId}`, { status: 1 })
            .reply(200, {
                data: {
                    id: '6a994bd1-6f88-48dc-a08e-d8c1c90272c4',
                    type: 'dataset',
                    attributes: {
                        name: 'Resource Watch datasets list',
                        slug: 'Resource-Watch-datasets-list_25',
                        type: null,
                        subtitle: null,
                        application: ['rw'],
                        dataPath: 'data',
                        attributesPath: null,
                        connectorType: 'document',
                        provider: 'json',
                        userId: '1a10d7c6e0a37126611fd7a7',
                        connectorUrl: 'http://api.resourcewatch.org/dataset',
                        tableName: 'index_6a994bd16f8848dca08ed8c1c90272c4_1553925631066',
                        status: 'saved',
                        published: true,
                        overwrite: false,
                        verified: false,
                        blockchain: {},
                        mainDateField: null,
                        env: 'production',
                        geoInfo: false,
                        protected: false,
                        legend: {
                            nested: [],
                            country: [],
                            region: [],
                            date: [],
                            integer: [],
                            short: [],
                            byte: [],
                            double: [],
                            float: [],
                            half_float: [],
                            scaled_float: [],
                            boolean: [],
                            binary: [],
                            string: [],
                            text: [],
                            keyword: []
                        },
                        clonedHost: {},
                        errorMessage: '',
                        taskId: '/v1/doc-importer/task/4e451d0e-a464-448f-9dc3-68cc493f0193',
                        updatedAt: '2019-03-30T06:15:26.762Z',
                        dataLastUpdated: null,
                        widgetRelevantProps: [],
                        layerRelevantProps: []
                    }
                }
            });


        const message = {
            id: 'e492cef7-e287-4bd8-9128-f034a3b531ef',
            type: 'STATUS_IMPORT_CONFIRMED',
            taskId: fakeTask1.id,
            lastCheckedDate: '2019-03-29T08:43:08.091Z'
        };

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code 3 seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.SAVED);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CREATE);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');
    });

    it('Consume a STATUS_IMPORT_CONFIRMED message for a TASK_CONCAT should create a EXECUTION_REINDEX message (happy case)', async () => {
        const fakeTask1 = await new Task(createTask(appConstants.TASK_STATUS.INIT, task.MESSAGE_TYPES.TASK_CONCAT)).save();

        const message = {
            id: 'e492cef7-e287-4bd8-9128-f034a3b531ef',
            type: 'STATUS_IMPORT_CONFIRMED',
            taskId: fakeTask1.id,
            lastCheckedDate: '2019-03-29T08:43:08.091Z'
        };

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code 3 seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.INIT);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CONCAT);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');

        const validateExecutorTasksQueueMessages = async (msg) => {
            const content = JSON.parse(msg.content.toString());
            content.should.have.property('id');
            content.should.have.property('type').and.equal(execution.MESSAGE_TYPES.EXECUTION_REINDEX);
            content.should.have.property('sourceIndex').and.equal(fakeTask1.message.index);
            content.should.have.property('targetIndex').and.equal(fakeTask1.index);
            content.should.have.property('taskId').and.equal(message.taskId);

            await channel.ack(msg);
        };

        process.on('unhandledRejection', (error) => {
            should.fail(error);
        });

        await channel.consume(config.get('queues.executorTasks'), validateExecutorTasksQueueMessages);
    });

    it('Consume a STATUS_IMPORT_CONFIRMED message for a TASK_APPEND should set the dataset and task to SAVED status (happy case)', async () => {
        const fakeTask1 = await new Task(createTask(appConstants.TASK_STATUS.INIT, task.MESSAGE_TYPES.TASK_APPEND)).save();

        const message = {
            id: 'e492cef7-e287-4bd8-9128-f034a3b531ef',
            type: 'STATUS_IMPORT_CONFIRMED',
            taskId: fakeTask1.id,
            lastCheckedDate: '2019-03-29T08:43:08.091Z'
        };

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${fakeTask1.datasetId}`, { status: 1 })
            .reply(200, {
                data: {
                    id: '6a994bd1-6f88-48dc-a08e-d8c1c90272c4',
                    type: 'dataset',
                    attributes: {
                        name: 'Resource Watch datasets list',
                        slug: 'Resource-Watch-datasets-list_25',
                        type: null,
                        subtitle: null,
                        application: ['rw'],
                        dataPath: 'data',
                        attributesPath: null,
                        connectorType: 'document',
                        provider: 'json',
                        userId: '1a10d7c6e0a37126611fd7a7',
                        connectorUrl: 'http://api.resourcewatch.org/dataset',
                        tableName: fakeTask1.index,
                        status: 'saved',
                        published: true,
                        overwrite: false,
                        verified: false,
                        blockchain: {},
                        mainDateField: null,
                        env: 'production',
                        geoInfo: false,
                        protected: false,
                        legend: {
                            nested: [],
                            country: [],
                            region: [],
                            date: [],
                            integer: [],
                            short: [],
                            byte: [],
                            double: [],
                            float: [],
                            half_float: [],
                            scaled_float: [],
                            boolean: [],
                            binary: [],
                            string: [],
                            text: [],
                            keyword: []
                        },
                        clonedHost: {},
                        errorMessage: '',
                        taskId: '/v1/doc-importer/task/4e451d0e-a464-448f-9dc3-68cc493f0193',
                        updatedAt: '2019-03-30T06:15:26.762Z',
                        dataLastUpdated: null,
                        widgetRelevantProps: [],
                        layerRelevantProps: []
                    }
                }
            });

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code 3 seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.SAVED);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_APPEND);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');
    });

    afterEach(async () => {
        Task.remove({}).exec();

        await channel.assertQueue(config.get('queues.status'));
        await channel.purgeQueue(config.get('queues.status'));
        const statusQueueStatus = await channel.checkQueue(config.get('queues.status'));
        statusQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.executorTasks'));
        await channel.purgeQueue(config.get('queues.executorTasks'));
        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.tasks'));
        await channel.purgeQueue(config.get('queues.tasks'));
        const tasksQueueStatus = await channel.checkQueue(config.get('queues.tasks'));
        tasksQueueStatus.messageCount.should.equal(0);

        if (!nock.isDone()) {
            const pendingMocks = nock.pendingMocks();
            nock.cleanAll();
            throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
        }
    });

    after(async () => {
        rabbitmqConnection.close();
    });
});
