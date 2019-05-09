/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const Task = require('models/task.model');
const { createTask, deserializeTask } = require('./utils');
const { getTestServer } = require('./test-server');

const should = chai.should();

let requester;

let fakeTask1;
let fakeTask2;
let fakeTask3;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Task get all tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestServer();

        Task.remove({}).exec();
    });

    it('Get all task with empty database should return 200 with empty array', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(0);
    });

    it('Get a list of existent tasks should return 200 with the existing tasks', async () => {
        fakeTask1 = await new Task(createTask('ERROR', 'TASK_CREATE', new Date('2019-02-01'))).save();
        fakeTask2 = await new Task(createTask('SAVED', 'TASK_CREATE', new Date('2019-01-01'))).save();
        fakeTask3 = await new Task(createTask('SAVED', 'TASK_OVERWRITE', new Date('2019-03-01'))).save();

        const response = await requester
            .get(`/api/v1/doc-importer/task`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(3);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];
        const task2 = responseTasks[1];
        const task3 = responseTasks[2];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);

        task2.should.have.property('datasetId').and.equal(fakeTask2.datasetId);
        task2.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task2.should.have.property('reads').and.equal(0);
        task2.should.have.property('writes').and.equal(0);
        task2.should.have.property('message').and.be.an('object');
        task2.should.have.property('status').and.equal(fakeTask2.status);
        task2.should.have.property('type').and.equal(fakeTask2.type);

        task3.should.have.property('datasetId').and.equal(fakeTask3.datasetId);
        task3.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task3.should.have.property('reads').and.equal(0);
        task3.should.have.property('writes').and.equal(0);
        task3.should.have.property('message').and.be.an('object');
        task3.should.have.property('status').and.equal(fakeTask3.status);
        task3.should.have.property('type').and.equal(fakeTask3.type);
    });

    it('Get a list of existent tasks filtered by status should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?status=SAVED`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(2);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];
        const task2 = responseTasks[1];

        task1.should.have.property('datasetId').and.equal(fakeTask2.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask2.status);
        task1.should.have.property('type').and.equal(fakeTask2.type);

        task2.should.have.property('datasetId').and.equal(fakeTask3.datasetId);
        task2.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task2.should.have.property('reads').and.equal(0);
        task2.should.have.property('writes').and.equal(0);
        task2.should.have.property('message').and.be.an('object');
        task2.should.have.property('status').and.equal(fakeTask3.status);
        task2.should.have.property('type').and.equal(fakeTask3.type);
    });

    it('Get a list of existent tasks filtered by type should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?type=TASK_OVERWRITE`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask3.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask3.status);
        task1.should.have.property('type').and.equal(fakeTask3.type);
    });

    it('Get a list of existent tasks filtered by createdAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?createdAt=2019-02-01`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);
    });

    it('Get a list of existent tasks filtered by before createdAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?createdBefore=2019-01-02`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask2.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask2.status);
        task1.should.have.property('type').and.equal(fakeTask2.type);
    });

    it('Get a list of existent tasks filtered by after createdAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?createdAfter=2019-01-02`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(2);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];
        const task2 = responseTasks[1];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);

        task2.should.have.property('datasetId').and.equal(fakeTask3.datasetId);
        task2.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task2.should.have.property('reads').and.equal(0);
        task2.should.have.property('writes').and.equal(0);
        task2.should.have.property('message').and.be.an('object');
        task2.should.have.property('status').and.equal(fakeTask3.status);
        task2.should.have.property('type').and.equal(fakeTask3.type);
    });

    it('Get a list of existent tasks filtered by before and after createdAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?createdAfter=2019-01-02&createdBefore=2019-02-02`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);
    });

    it('Get a list of existent tasks filtered by updatedAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?updatedAt=2019-02-01`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);
    });

    it('Get a list of existent tasks filtered by before updatedAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?updatedBefore=2019-01-02`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask2.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask2.status);
        task1.should.have.property('type').and.equal(fakeTask2.type);
    });

    it('Get a list of existent tasks filtered by after updatedAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?updatedAfter=2019-01-02`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(2);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];
        const task2 = responseTasks[1];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);

        task2.should.have.property('datasetId').and.equal(fakeTask3.datasetId);
        task2.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task2.should.have.property('reads').and.equal(0);
        task2.should.have.property('writes').and.equal(0);
        task2.should.have.property('message').and.be.an('object');
        task2.should.have.property('status').and.equal(fakeTask3.status);
        task2.should.have.property('type').and.equal(fakeTask3.type);
    });

    it('Get a list of existent tasks filtered by before and after updatedAt should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?updatedAfter=2019-01-02&updatedBefore=2019-02-02`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);
    });

    it('Get a list of existent tasks filtered by multiple filters should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?updatedBefore=2019-02-02&status=ERROR`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);
    });

    it('Get a list of existent tasks filtered by dataset id should return 200 with the filtered task list', async () => {
        const response = await requester
            .get(`/api/v1/doc-importer/task?datasetId=${fakeTask1.datasetId}`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(1);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[0];

        task1.should.have.property('datasetId').and.equal(fakeTask1.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask1.status);
        task1.should.have.property('type').and.equal(fakeTask1.type);
    });

    afterEach(() => {
        if (!nock.isDone()) {
            const pendingMocks = nock.pendingMocks();
            nock.cleanAll();
            throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
        }
    });

    after(() => {
        Task.remove({}).exec();
    });
});
