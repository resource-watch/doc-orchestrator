/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const amqp = require('amqplib');
const config = require('config');
const appConstants = require('app.constants');
const Task = require('models/task.model');
const RabbitMQConnectionError = require('errors/rabbitmq-connection.error');
const { task, execution } = require('doc-importer-messages');
const { getTestServer } = require('./test-server');
const sleep = require('sleep');

const should = chai.should();

let requester;
let rabbitmqConnection = null;
let channel;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('DOC-TASK handling process', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        let connectAttempts = 10;
        while (connectAttempts >= 0 && rabbitmqConnection === null) {
            try {
                rabbitmqConnection = await amqp.connect(config.get('rabbitmq.url'));
            } catch (err) {
                connectAttempts--;
                await sleep.sleep(5);
            }
        }
        if (!rabbitmqConnection) {
            throw new RabbitMQConnectionError();
        }

        channel = await rabbitmqConnection.createConfirmChannel();
        await channel.assertQueue(config.get('queues.docTasks'));
        await channel.assertQueue(config.get('queues.executorTasks'));

        requester = await getTestServer();

        Task.remove({}).exec();
    });

    beforeEach(async () => {
        await channel.purgeQueue(config.get('queues.docTasks'));
        await channel.purgeQueue(config.get('queues.executorTasks'));

        const executorQueueStatus = await channel.checkQueue(config.get('queues.executorTasks'));
        const docsQueueStatus = await channel.checkQueue(config.get('queues.docTasks'));
        executorQueueStatus.messageCount.should.equal(0);
        docsQueueStatus.messageCount.should.equal(0);

    })

    it('Consume a doc task and create a new task (happy case)', async () => {
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

        const preDocsQueueStatus = await channel.assertQueue(config.get('queues.docTasks'));
        preDocsQueueStatus.messageCount.should.equal(0);
        const preQueueStatus = await channel.assertQueue(config.get('queues.executorTasks'));
        preQueueStatus.messageCount.should.equal(0);


        await channel.sendToQueue(config.get('queues.docTasks'), Buffer.from(JSON.stringify(message)));

        // Give the code 5 seconds to do its thing
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
        createdTask.should.have.property('status').and.equal(appConstants.STATUS.INIT);
        createdTask.should.have.property('reads').and.equal(0);
        createdTask.should.have.property('writes').and.equal(0);
        createdTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        createdTask.should.have.property('_id').and.equal(message.id);
        createdTask.should.have.property('type').and.equal(task.MESSAGE_TYPES.TASK_CREATE);
        createdTask.should.have.property('message').and.be.an('object');
        createdTask.should.have.property('datasetId').and.equal(`${timestamp}`);
        createdTask.should.have.property('createdAt').and.be.a('date');
        createdTask.should.have.property('updatedAt').and.be.a('date');
    });

    afterEach(async () => {
        await channel.assertQueue(config.get('queues.docTasks'));
        await channel.purgeQueue(config.get('queues.docTasks'));
        const docsQueueStatus = await channel.checkQueue(config.get('queues.docTasks'));
        docsQueueStatus.messageCount.should.equal(0);

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
