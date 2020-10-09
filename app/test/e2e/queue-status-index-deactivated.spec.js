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
const uuidV4 = require('uuid/v4');
const { getTestServer } = require('./utils/test-server');
const { createTask } = require('./utils/helpers');

chai.should();

let requester;
let rabbitmqConnection = null;
let channel;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('STATUS_INDEX_DEACTIVATED handling process', () => {

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

    it('Consume a STATUS_INDEX_DEACTIVATED message with an index matching the task\'s should update the task status to INDEX_CREATED and index to the message\'s index, and update the dataset\'s status to pending', async () => {
        const fakeTask1 = await new Task(createTask({
            status: appConstants.TASK_STATUS.INIT,
            type: task.MESSAGE_TYPES.TASK_APPEND,
            reads: 0,
            writes: 0,
            filesProcessed: 0
        })).save();

        const message = {
            id: '8ad03428-bc93-43b8-8b8c-857a58d000c6',
            type: 'STATUS_INDEX_DEACTIVATED',
            taskId: fakeTask1.id,
            index: fakeTask1.index
        };

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${fakeTask1.datasetId}`, { status: 0 })
            .once()
            .reply(200, {});

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code a few seconds to do its thing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.INDEX_CREATED);
        createdTask.should.have.property('index').and.equal(message.index);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('filesProcessed').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_APPEND);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');
    });

    it('Consume a STATUS_INDEX_DEACTIVATED message with an index not matching the task\'s should update the task status to INDEX_CREATED and index to the message\'s index, and update the dataset\'s status to pending', async () => {
        const fakeTask1 = await new Task(createTask({
            status: appConstants.TASK_STATUS.INIT,
            type: task.MESSAGE_TYPES.TASK_APPEND,
            reads: 0,
            writes: 0,
            filesProcessed: 0
        })).save();

        const message = {
            id: '8ad03428-bc93-43b8-8b8c-857a58d000c6',
            type: 'STATUS_INDEX_DEACTIVATED',
            taskId: fakeTask1.id,
            index: uuidV4()
        };

        nock(process.env.CT_URL)
            .patch(`/v1/dataset/${fakeTask1.datasetId}`, { status: 0 })
            .once()
            .reply(200, {});

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code a few seconds to do its thing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.INDEX_CREATED);
        createdTask.should.have.property('index').and.equal(message.index);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('filesProcessed').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_APPEND);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');

        let expectedExecutorQueueMessageCount = 1;

        const validateExecutorQueueMessages = (resolve) => async (msg) => {
            const content = JSON.parse(msg.content.toString());
            if (content.type === execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX) {
                content.should.have.property('id');
                content.should.have.property('type').and.equal(execution.MESSAGE_TYPES.EXECUTION_DELETE_INDEX);
                content.should.have.property('index').and.equal(fakeTask1.index);
                content.should.have.property('taskId').and.equal(message.taskId);
            } else {
                throw new Error(`Unexpected message type: ${content.type}`);
            }

            await channel.ack(msg);

            expectedExecutorQueueMessageCount -= 1;

            if (expectedExecutorQueueMessageCount < 0) {
                throw new Error(`Unexpected message count - expectedExecutorQueueMessageCount:${expectedExecutorQueueMessageCount}`);
            }

            if (expectedExecutorQueueMessageCount === 0) {
                resolve();
            }
        };

        return new Promise((resolve) => {
            channel.consume(config.get('queues.executorTasks'), validateExecutorQueueMessages(resolve));
        });
    });

    afterEach(async () => {
        await channel.assertQueue(config.get('queues.status'));
        const statusQueueStatus = await channel.checkQueue(config.get('queues.status'));
        statusQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.executorTasks'));
        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorQueueStatus.messageCount.should.equal(0);

        if (!nock.isDone()) {
            const pendingMocks = nock.pendingMocks();
            if (pendingMocks.length > 1) {
                throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
            }
        }
    });

    after(async () => {
        await Task.deleteMany({}).exec();

        rabbitmqConnection.close();
    });
});
