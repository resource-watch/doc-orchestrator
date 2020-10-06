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
const { getTestServer } = require('./utils/test-server');

chai.should();

let requester;
let rabbitmqConnection = null;
let channel;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('TASK_CONCAT handling process', () => {

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

        requester = await getTestServer();
    });

    beforeEach(async () => {
        channel = await rabbitmqConnection.createConfirmChannel();

        await channel.assertQueue(config.get('queues.status'));
        await channel.assertQueue(config.get('queues.tasks'));
        await channel.assertQueue(config.get('queues.executorTasks'));

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

    it('Consume a TASK_CONCAT message and create a new task and a EXECUTION_CONCAT message (happy case)', async () => {
        const timestamp = new Date().getTime();

        const message = {
            id: 'f6dfd42f-cf6c-41ae-bf66-dfe08025087e',
            type: 'TASK_CONCAT',
            datasetId: timestamp,
            fileUrl: ['http://api.resourcewatch.org/dataset'],
            provider: 'json',
            index: 'index_19f49246250d40d3a85b1da95c1b69e5_1551684629846'
        };

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${timestamp}`, {
                taskId: `/v1/doc-importer/task/${message.id}`,
                status: 0,
                errorMessage: ''
            })
            .once()
            .reply(200);

        const preDocsQueueStatus = await channel.assertQueue(config.get('queues.tasks'));
        preDocsQueueStatus.messageCount.should.equal(0);
        const preQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        preQueueStatus.messageCount.should.equal(0);
        const emptyTaskList = await Task.find({}).exec();
        emptyTaskList.should.be.an('array').and.have.lengthOf(0);

        await channel.sendToQueue(config.get('queues.tasks'), Buffer.from(JSON.stringify(message)));

        let expectedExecutorQueueMessageCount = 1;

        const validateExecutorQueueMessages = (resolve) => async (msg) => {
            const content = JSON.parse(msg.content.toString());
            if (content.type === execution.MESSAGE_TYPES.EXECUTION_CONCAT) {
                content.should.have.property('datasetId').and.equal(timestamp);
                content.should.have.property('id');
                content.should.have.property('fileUrl').and.be.an('array').and.eql(message.fileUrl);
                content.should.have.property('provider').and.equal('json');
                content.should.have.property('taskId').and.equal(message.id);
                content.should.have.property('index').and.match(new RegExp(`index_(\\w*)_(\\w*)`));
            } else {
                throw new Error(`Unexpected message type: ${content.type}`);
            }
            await channel.ack(msg);

            const createdTasks = await Task.find({}).exec();

            createdTasks.should.be.an('array').and.have.lengthOf(1);
            const createdTask = createdTasks[0];
            createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.INIT);
            createdTask.should.have.property('reads').and.equal(0);
            createdTask.should.have.property('writes').and.equal(0);
            createdTask.should.have.property('filesProcessed').and.equal(0);
            createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
            createdTask.should.have.property('_id').and.equal(message.id);
            createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CONCAT);
            createdTask.should.have.property('message').and.be.an('object');
            createdTask.should.have.property('datasetId').and.equal(`${timestamp}`);
            createdTask.should.have.property('createdAt').and.be.a('date');
            createdTask.should.have.property('updatedAt').and.be.a('date');

            expectedExecutorQueueMessageCount -= 1;

            if (expectedExecutorQueueMessageCount < 0) {
                throw new Error(`Unexpected message count - expectedExecutorQueueMessageCount:${expectedExecutorQueueMessageCount}`);
            }

            if (expectedExecutorQueueMessageCount === 0) {
                resolve();
            }
        };

        return new Promise((resolve) => {
            channel.consume(config.get('queues.executorTasks'), validateExecutorQueueMessages(resolve), { exclusive: true });
        });
    });

    it('Consume a TASK_CONCAT message while not being able to reach the dataset microservice (500) should retry 10 times and ot create a task nor issue additional messages', async () => {
        const timestamp = new Date().getTime();

        const message = {
            id: 'f6dfd42f-cf6c-41ae-bf66-dfe08025087e',
            type: 'TASK_CONCAT',
            datasetId: timestamp,
            fileUrl: ['http://api.resourcewatch.org/dataset'],
            provider: 'json',
            index: 'index_19f49246250d40d3a85b1da95c1b69e5_1551684629846'
        };

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${timestamp}`, {
                taskId: `/v1/doc-importer/task/${message.id}`,
                status: 0,
                errorMessage: ''
            })
            .times(11)
            .reply(500, { error: 'dataset microservice unavailable' });

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${timestamp}`, {
                taskId: '',
                status: 0
            })
            .times(11)
            .reply(200, {});

        const preDocsQueueStatus = await channel.assertQueue(config.get('queues.tasks'));
        preDocsQueueStatus.messageCount.should.equal(0);
        const preQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        preQueueStatus.messageCount.should.equal(0);
        const emptyTaskList = await Task.find({}).exec();
        emptyTaskList.should.be.an('array').and.have.lengthOf(0);

        await channel.sendToQueue(config.get('queues.tasks'), Buffer.from(JSON.stringify(message)));

        // Give the code a few seconds to do its thing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(0);
    });

    it('Consume a TASK_CONCAT message while not being able to reach the dataset microservice (404) should retry 10 times and ot create a task nor issue additional messages', async () => {
        const timestamp = new Date().getTime();

        const message = {
            id: 'f6dfd42f-cf6c-41ae-bf66-dfe08025087e',
            type: 'TASK_CONCAT',
            datasetId: timestamp,
            fileUrl: ['http://api.resourcewatch.org/dataset'],
            provider: 'json',
            index: 'index_19f49246250d40d3a85b1da95c1b69e5_1551684629846'
        };

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${timestamp}`, {
                taskId: `/v1/doc-importer/task/${message.id}`,
                status: 0,
                errorMessage: ''
            })
            .times(11)
            .reply(404, { error: 'dataset not found' });

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${timestamp}`, {
                taskId: '',
                status: 0
            })
            .times(11)
            .reply(200, {});

        const preDocsQueueStatus = await channel.assertQueue(config.get('queues.tasks'));
        preDocsQueueStatus.messageCount.should.equal(0);
        const preQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        preQueueStatus.messageCount.should.equal(0);
        const emptyTaskList = await Task.find({}).exec();
        emptyTaskList.should.be.an('array').and.have.lengthOf(0);

        await channel.sendToQueue(config.get('queues.tasks'), Buffer.from(JSON.stringify(message)));

        // Give the code a few seconds to do its thing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(0);
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
            if (pendingMocks.length > 1) {
                throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
            }
        }

        await channel.close();
        channel = null;
    });

    after(async () => {
        rabbitmqConnection.close();
    });
});
