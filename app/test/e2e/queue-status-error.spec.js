/* eslint-disable no-unused-vars,no-undef,no-await-in-loop */
const nock = require('nock');
const chai = require('chai');
const amqp = require('amqplib');
const config = require('config');
const appConstants = require('app.constants');
const Task = require('models/task.model');
const RabbitMQConnectionError = require('errors/rabbitmq-connection.error');
const { task } = require('rw-doc-importer-messages');
const sleep = require('sleep');
const { getTestServer } = require('./utils/test-server');
const { createTask } = require('./utils/helpers');

chai.should();

let requester;
let rabbitmqConnection = null;
let channel;


nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('STATUS_ERROR handling process', () => {

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

        await Task.deleteMany({}).exec();
    });

    it('Consume a STATUS_ERROR message for a task should set task and dataset statuses to error and set the appropriate error messages (happy case)', async () => {
        const fakeTask1 = await new Task(createTask({
            status: appConstants.TASK_STATUS.INIT,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${fakeTask1.datasetId}`, {
                status: 2,
                errorMessage: 'Exceeded maximum number of attempts to process message of type "EXECUTION_READ_FILE". Error message: "Something bad happened"'
            })
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
                        errorMessage: 'Exceeded maximum number of attempts to process message of type "EXECUTION_READ_FILE". Error message: "undefined"',
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
            type: 'STATUS_ERROR',
            taskId: fakeTask1.id,
            error: 'Exceeded maximum number of attempts to process message of type "EXECUTION_READ_FILE". Error message: "Something bad happened"'
        };

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code a few seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.ERROR);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('fileCount').and.equal(0);
        createdTask.should.have.property('error').and.equal('Exceeded maximum number of attempts to process message of type "EXECUTION_READ_FILE". Error message: "Something bad happened"');
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CREATE);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');
    });

    afterEach(async () => {
        await Task.deleteMany({}).exec();

        await channel.assertQueue(config.get('queues.status'));
        const statusQueueStatus = await channel.checkQueue(config.get('queues.status'));
        statusQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.executorTasks'));
        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.tasks'));
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
