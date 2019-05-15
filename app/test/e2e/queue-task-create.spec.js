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

const should = chai.should();

let requester;
let rabbitmqConnection = null;
let channel;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('TASK_CREATE handling process', () => {

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

        Task.remove({}).exec();
    });

    beforeEach(async () => {
        channel = await rabbitmqConnection.createConfirmChannel();
        await channel.assertQueue(config.get('queues.status'));
        await channel.assertQueue(config.get('queues.tasks'));
        await channel.assertQueue(config.get('queues.executorTasks'));

        await channel.purgeQueue(config.get('queues.status'));
        await channel.purgeQueue(config.get('queues.tasks'));
        await channel.purgeQueue(config.get('queues.executorTasks'));

        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        const docsQueueStatus = await channel.checkQueue(config.get('queues.tasks'));

        executorQueueStatus.messageCount.should.equal(0);
        docsQueueStatus.messageCount.should.equal(0);

    });

    it('Consume a TASK_CREATE message and create a new task and EXECUTION_CREATE message (happy case)', async () => {
        const timestamp = new Date().getTime();

        const message = {
            id: 'ffe306e0-519f-478b-8a79-7a3123c0c8b9',
            type: task.MESSAGE_TYPES.TASK_CREATE,
            datasetId: timestamp,
            fileUrl: 'https://wri-01.carto.com/tables/wdpa_protected_areas/table.csv',
            provider: 'csv'
        };

        nock(`${process.env.CT_URL}`)
            .patch(`/v1/dataset/${timestamp}`, (body) => body.taskId === `/v1/doc-importer/task/${message.id}` && body.status === 0)
            .once()
            .reply(200);

        const preDocsQueueStatus = await channel.assertQueue(config.get('queues.tasks'));
        preDocsQueueStatus.messageCount.should.equal(0);
        const preQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        preQueueStatus.messageCount.should.equal(0);
        const emptyTaskList = await Task.find({}).exec();
        emptyTaskList.should.be.an('array').and.have.lengthOf(0);


        await channel.sendToQueue(config.get('queues.tasks'), Buffer.from(JSON.stringify(message)));

        // Give the code 3 seconds to do its thing
        await new Promise(resolve => setTimeout(resolve, 3000));

        const postQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        postQueueStatus.messageCount.should.equal(1);

        const validateMessage = async (msg) => {
            const content = JSON.parse(msg.content.toString());
            content.should.have.property('datasetId').and.equal(timestamp);
            content.should.have.property('id');
            content.should.have.property('fileUrl');
            content.should.have.property('provider').and.equal('csv');
            content.should.have.property('type').and.equal(execution.MESSAGE_TYPES.EXECUTION_CREATE);
            content.should.have.property('taskId').and.equal(message.id);

            await channel.ack(msg);
        };

        await channel.consume(config.get('queues.executorTasks'), validateMessage);

        const createdTasks = await Task.find({}).exec();

        createdTasks.should.be.an('array').and.have.lengthOf(1);
        const createdTask = createdTasks[0];
        createdTask.should.have.property('status').and.equal(appConstants.TASK_STATUS.INIT);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        createdTask.should.have.property('_id').and.equal(message.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CREATE);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(`${timestamp}`);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');

        process.on('unhandledRejection', (error) => {
            should.fail(error);
        });
    });

    afterEach(async () => {
        Task.remove({}).exec();

        await channel.assertQueue(config.get('queues.tasks'));
        await channel.purgeQueue(config.get('queues.tasks'));
        const docsQueueStatus = await channel.checkQueue(config.get('queues.tasks'));
        docsQueueStatus.messageCount.should.equal(0);

        await channel.assertQueue(config.get('queues.executorTasks'));
        await channel.purgeQueue(config.get('queues.executorTasks'));
        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        executorQueueStatus.messageCount.should.equal(0);

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
