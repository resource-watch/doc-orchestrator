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

        await Task.remove({}).exec();
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


    it('Get a list of existent tasks should return 200 with the existing tasks, and include details loaded from elasticsearch', async () => {
        const elasticTaskResponseObject = {
            completed: true,
            task: {
                node: 'dmv1LILaTX-12NIPKcK3BQ',
                id: 1440921,
                type: 'transport',
                action: 'indices:data/write/reindex',
                status: {
                    total: 100401,
                    updated: 0,
                    created: 100401,
                    deleted: 0,
                    batches: 101,
                    version_conflicts: 0,
                    noops: 0,
                    retries: {
                        bulk: 0,
                        search: 0
                    },
                    throttled_millis: 0,
                    requests_per_second: -1.0,
                    throttled_until_millis: 0
                },
                description: 'reindex from [index_50598b08c2b44db58b211b89cdb5b45d_1558614485391] to [index_50598b08c2b44db58b211b89cdb5b45d_1558678517870]',
                start_time_in_millis: 1558678595813,
                running_time_in_nanos: 41651527569,
                cancellable: true
            },
            response: {
                took: 41651,
                timed_out: false,
                total: 100401,
                updated: 0,
                created: 100401,
                deleted: 0,
                batches: 101,
                version_conflicts: 0,
                noops: 0,
                retries: {
                    bulk: 0,
                    search: 0
                },
                throttled_millis: 0,
                requests_per_second: -1.0,
                throttled_until_millis: 0,
                failures: []
            }
        };

        const fakeTask4 = await new Task(createTask('ERROR', 'TASK_CREATE', new Date('2019-02-01'))).save();

        fakeTask4.logs = [
            {
                id: '782177aa-fb56-4cf9-bf2c-a9d2cc435a13',
                type: 'STATUS_PERFORMED_REINDEX',
                taskId: '76836c30-7e9f-4537-9e7e-fc33aeabfab4',
                lastCheckedDate: '2019-05-24T06:16:35.815Z',
                elasticTaskId: 'dmv1LILaTX-12NIPKcK3BQ:1440921'
            }];
        await fakeTask4.save();

        nock(`http://${process.env.ELASTIC_URL}`)
            .get(`/_tasks/${encodeURIComponent(fakeTask4.logs[0].elasticTaskId)}`)
            .reply(200, elasticTaskResponseObject);

        const response = await requester
            .get(`/api/v1/doc-importer/task`)
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('array').and.have.length(4);

        const responseTasks = deserializeTask(response);
        const task1 = responseTasks[3];

        task1.should.have.property('datasetId').and.equal(fakeTask4.datasetId);
        task1.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);
        task1.should.have.property('reads').and.equal(0);
        task1.should.have.property('writes').and.equal(0);
        task1.should.have.property('message').and.be.an('object');
        task1.should.have.property('status').and.equal(fakeTask4.status);
        task1.should.have.property('type').and.equal(fakeTask4.type);

        const log = task1.logs[0];
        log.should.have.property('elasticTaskId').and.be.a('string').and.equal('dmv1LILaTX-12NIPKcK3BQ:1440921');
        log.should.have.property('elasticTaskStatus').and.be.an('object').and.deep.equal(elasticTaskResponseObject);
    });

    afterEach(() => {
        if (!nock.isDone()) {
            const pendingMocks = nock.pendingMocks();
            nock.cleanAll();
            throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
        }
    });

    after(async () => {
        await Task.remove({}).exec();
    });
});
