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
const { getTestServer } = require('./test-server');
const { createTask } = require('./utils');

const should = chai.should();

let requester;
let rabbitmqConnection = null;
let channel;

let fakeTask1;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('STATUS_WRITTEN_DATA handling process', () => {

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
        await channel.assertQueue(config.get('queues.executorTasks'));

        requester = await getTestServer();

        await Task.remove({}).exec();

        fakeTask1 = await new Task(createTask(appConstants.STATUS.READ, task.MESSAGE_TYPES.TASK_CREATE, new Date(), 2)).save();
    });

    beforeEach(async () => {
        await channel.purgeQueue(config.get('queues.status'));
        await channel.purgeQueue(config.get('queues.executorTasks'));

        const statusQueueStatus = await channel.checkQueue(config.get('queues.status'));
        statusQueueStatus.messageCount.should.equal(0);

        const executorTasksQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorTasksQueueStatus.messageCount.should.equal(0);

    });

    it('Consume a STATUS_WRITTEN_DATA message should update task read count (happy case, not last write)', async () => {
        const message = {
            id: 'abe967e0-90bd-43ed-8c96-ae8c93e1afb3',
            type: 'STATUS_WRITTEN_DATA',
            taskId: fakeTask1.id,
            withErrors: false,
            detail: ''
        };

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code 3 seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 3000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.STATUS.READ);
        createdTask.should.have.property('reads').and.equal(2);
        createdTask.should.have.property('writes').and.equal(1);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CREATE);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');
    });

    it('Consume a STATUS_WRITTEN_DATA message should update task read count (happy case, last write)', async () => {
        const message = {
            id: 'abe967e0-90bd-43ed-8c96-ae8c93e1afb3',
            type: 'STATUS_WRITTEN_DATA',
            taskId: fakeTask1.id,
            withErrors: false,
            detail: ''
        };

        const preStatusQueueStatus = await channel.assertQueue(config.get('queues.status'));
        preStatusQueueStatus.messageCount.should.equal(0);
        const existingTaskList = await Task.find({}).exec();
        existingTaskList.should.be.an('array').and.have.lengthOf(1);

        await channel.sendToQueue(config.get('queues.status'), Buffer.from(JSON.stringify(message)));

        // Give the code 3 seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 3000));


        const postQueueStatus = await channel.assertQueue(config.get('queues.status'));
        postQueueStatus.messageCount.should.equal(0);

        const postExecutorTasksStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        postExecutorTasksStatus.messageCount.should.equal(1);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.STATUS.READ);
        createdTask.should.have.property('reads').and.equal(2);
        createdTask.should.have.property('writes').and.equal(2);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(2);
        createdTask.should.have.property('_id').and.equal(fakeTask1.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CREATE);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');

        const validateExecutorTasksQueueMessages = async (msg) => {
            const content = JSON.parse(msg.content.toString());
            content.should.have.property('id');
            content.should.have.property('type').and.equal(execution.MESSAGE_TYPES.EXECUTION_CONFIRM_IMPORT);
            content.should.have.property('index').and.equal(fakeTask1.index);
            content.should.have.property('taskId').and.equal(message.taskId);

            await channel.ack(msg);
        };

        await channel.consume(config.get('queues.executorTasks'), validateExecutorTasksQueueMessages);
    });

    afterEach(async () => {
        await channel.assertQueue(config.get('queues.status'));
        await channel.purgeQueue(config.get('queues.status'));
        const statusQueueStatus = await channel.checkQueue(config.get('queues.status'));
        statusQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.executorTasks'));
        await channel.purgeQueue(config.get('queues.executorTasks'));
        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorQueueStatus.messageCount.should.equal(0);

        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });

    after(async () => {
        Task.remove({}).exec();

        rabbitmqConnection.close();
    });
});
