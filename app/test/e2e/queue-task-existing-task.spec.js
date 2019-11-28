/* eslint-disable no-unused-vars,no-undef,no-await-in-loop */
const nock = require('nock');
const chai = require('chai');
const amqp = require('amqplib');
const config = require('config');
const Task = require('models/task.model');
const RabbitMQConnectionError = require('errors/rabbitmq-connection.error');
const sleep = require('sleep');
const { getTestServer } = require('./test-server');
const { createTask } = require('./utils');

chai.should();

let requester;
let rabbitmqConnection = null;
let channel;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Handle new task when an existing task is in progress', () => {

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

    it('Consume a TASK_APPEND message when a message in process already exists should update the dataset with a meaningful error message (happy case)', async () => {
        const fakeTask1 = await new Task(createTask('INDEX_CREATED', 'TASK_CREATE', new Date('2019-02-01'))).save();

        const message = {
            id: 'f6dfd42f-cf6c-41ae-bf66-dfe08025087e',
            type: 'TASK_APPEND',
            datasetId: fakeTask1.datasetId,
            fileUrl: ['http://api.resourcewatch.org/dataset'],
            provider: 'json',
            index: 'index_19f49246250d40d3a85b1da95c1b69e5_1551684629846',
            append: false
        };

        const preDocsQueueStatus = await channel.assertQueue(config.get('queues.tasks'));
        preDocsQueueStatus.messageCount.should.equal(0);
        const preQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        preQueueStatus.messageCount.should.equal(0);
        const preTaskList = await Task.find({}).exec();
        preTaskList.should.be.an('array').and.have.lengthOf(1);

        return new Promise((resolve) => {
            nock(process.env.CT_URL)
                .patch(`/v1/dataset/${fakeTask1.datasetId}`, {
                    status: 1,
                    errorMessage: `Task(s) ${fakeTask1.id} already running, operation cancelled.`
                })
                .once()
                .reply(200, () => resolve());

            channel.sendToQueue(config.get('queues.tasks'), Buffer.from(JSON.stringify(message)));
        });
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

        await channel.close();
        channel = null;
    });

    after(async () => {
        rabbitmqConnection.close();
    });
});
