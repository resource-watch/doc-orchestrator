/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const config = require('config');
const Task = require('models/task.model');
const { task } = require('rw-doc-importer-messages');
const appConstants = require('app.constants');
const { createTask, deserializeTask } = require('./utils/helpers');
const { getTestServer } = require('./utils/test-server');

const should = chai.should();

let requester;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Task get tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestServer();

        await Task.deleteMany({}).exec();
    });

    it('Get a non-existent task should return 404', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .get(`/api/v1/doc-importer/task/${timestamp}`)
            .send();

        response.status.should.equal(404);
    });

    it('Get an existing task should return 200', async () => {
        const fakeTask = await new Task(createTask({
            status: appConstants.TASK_STATUS.SAVED,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();

        const response = await requester
            .get(`/api/v1/doc-importer/task/${fakeTask._id}`)
            .send();
        const responseTask = deserializeTask(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        responseTask.should.have.property('datasetId').and.equal(fakeTask.datasetId);
        responseTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        responseTask.should.have.property('reads').and.equal(0);
        responseTask.should.have.property('writes').and.equal(0);
        responseTask.should.have.property('filesProcessed').and.equal(0);
        responseTask.should.have.property('message').and.be.an('object');
        responseTask.should.have.property('status').and.equal(fakeTask.status);
        responseTask.should.have.property('type').and.equal(fakeTask.type);
    });

    it('Get an existing task containing a log entry with an elasticTaskId should return 200 with the task details including the Elasticsearch task info (happy case)', async () => {
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

        const fakeTask = await new Task(createTask({
            status: appConstants.TASK_STATUS.SAVED,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();
        fakeTask.logs = [
            {
                id: '782177aa-fb56-4cf9-bf2c-a9d2cc435a13',
                type: 'STATUS_PERFORMED_REINDEX',
                taskId: '76836c30-7e9f-4537-9e7e-fc33aeabfab4',
                lastCheckedDate: '2019-05-24T06:16:35.815Z',
                elasticTaskId: 'dmv1LILaTX-12NIPKcK3BQ:1440921'
            }];
        await fakeTask.save();

        nock(config.get('elasticsearch.host'))
            .get(`/_tasks/${encodeURIComponent(fakeTask.logs[0].elasticTaskId)}`)
            .reply(200, elasticTaskResponseObject);

        const response = await requester
            .get(`/api/v1/doc-importer/task/${fakeTask._id}`)
            .send();
        const responseTask = deserializeTask(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        responseTask.should.have.property('datasetId').and.equal(fakeTask.datasetId);
        responseTask.should.have.property('reads').and.equal(0);
        responseTask.should.have.property('writes').and.equal(0);
        responseTask.should.have.property('filesProcessed').and.equal(0);
        responseTask.should.have.property('message').and.be.an('object');
        responseTask.should.have.property('status').and.equal(fakeTask.status);
        responseTask.should.have.property('type').and.equal(fakeTask.type);
        responseTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);

        const log = responseTask.logs[0];
        log.should.have.property('elasticTaskId').and.be.a('string').and.equal('dmv1LILaTX-12NIPKcK3BQ:1440921');
        log.should.have.property('elasticTaskStatus').and.be.an('object').and.deep.equal(elasticTaskResponseObject);

    });

    it('Get an existing task containing a log entry with an elasticTaskId that does not exist return 200 with the task details including the Elasticsearch task info', async () => {
        const elasticTaskResponseObject = {
            error: {
                root_cause: [
                    {
                        type: 'resource_not_found_exception',
                        reason: 'task [Q241js3tS1iqYqHwZd-P7g:123456] isn\'t running and hasn\'t stored its results'
                    }
                ],
                type: 'resource_not_found_exception',
                reason: 'task [Q241js3tS1iqYqHwZd-P7g:123456] isn\'t running and hasn\'t stored its results'
            },
            status: 404
        };

        const fakeTask = await new Task(createTask({
            status: appConstants.TASK_STATUS.SAVED,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();
        fakeTask.logs = [
            {
                id: '782177aa-fb56-4cf9-bf2c-a9d2cc435a13',
                type: 'STATUS_PERFORMED_REINDEX',
                taskId: '76836c30-7e9f-4537-9e7e-fc33aeabfab4',
                lastCheckedDate: '2019-05-24T06:16:35.815Z',
                elasticTaskId: 'dmv1LILaTX-12NIPKcK3BQ:1440921'
            }];
        await fakeTask.save();

        nock(config.get('elasticsearch.host'))
            .get(`/_tasks/${encodeURIComponent(fakeTask.logs[0].elasticTaskId)}`)
            .reply(404, elasticTaskResponseObject);

        const response = await requester
            .get(`/api/v1/doc-importer/task/${fakeTask._id}`)
            .send();
        const responseTask = deserializeTask(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        responseTask.should.have.property('datasetId').and.equal(fakeTask.datasetId);
        responseTask.should.have.property('reads').and.equal(0);
        responseTask.should.have.property('writes').and.equal(0);
        responseTask.should.have.property('filesProcessed').and.equal(0);
        responseTask.should.have.property('message').and.be.an('object');
        responseTask.should.have.property('status').and.equal(fakeTask.status);
        responseTask.should.have.property('type').and.equal(fakeTask.type);
        responseTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);

        const log = responseTask.logs[0];
        log.should.have.property('elasticTaskId').and.be.a('string').and.equal('dmv1LILaTX-12NIPKcK3BQ:1440921');
        log.should.have.property('elasticTaskStatus').and.be.an('object').and.deep.equal(elasticTaskResponseObject);

    });

    it('Get an existing task containing a log entry with an invalid elasticTaskId return 200 with the task details including the Elasticsearch task info', async () => {
        const elasticTaskResponseObject = {
            error: {
                root_cause: [
                    {
                        type: 'illegal_argument_exception',
                        reason: 'malformed task id Q241js3tS1iqYqHwZd-P7g'
                    }
                ],
                type: 'illegal_argument_exception',
                reason: 'malformed task id Q241js3tS1iqYqHwZd-P7g'
            },
            status: 400
        };

        const fakeTask = await new Task(createTask({
            status: appConstants.TASK_STATUS.SAVED,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();
        fakeTask.logs = [
            {
                id: '782177aa-fb56-4cf9-bf2c-a9d2cc435a13',
                type: 'STATUS_PERFORMED_REINDEX',
                taskId: '76836c30-7e9f-4537-9e7e-fc33aeabfab4',
                lastCheckedDate: '2019-05-24T06:16:35.815Z',
                elasticTaskId: 'dmv1LILaTX-12NIPKcK3BQ:1440921'
            }];
        await fakeTask.save();

        nock(config.get('elasticsearch.host'))
            .get(`/_tasks/${encodeURIComponent(fakeTask.logs[0].elasticTaskId)}`)
            .reply(400, elasticTaskResponseObject);

        const response = await requester
            .get(`/api/v1/doc-importer/task/${fakeTask._id}`)
            .send();
        const responseTask = deserializeTask(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        responseTask.should.have.property('datasetId').and.equal(fakeTask.datasetId);
        responseTask.should.have.property('reads').and.equal(0);
        responseTask.should.have.property('writes').and.equal(0);
        responseTask.should.have.property('filesProcessed').and.equal(0);
        responseTask.should.have.property('message').and.be.an('object');
        responseTask.should.have.property('status').and.equal(fakeTask.status);
        responseTask.should.have.property('type').and.equal(fakeTask.type);
        responseTask.should.have.property('logs').and.be.an('array').and.have.lengthOf(1);

        const log = responseTask.logs[0];
        log.should.have.property('elasticTaskId').and.be.a('string').and.equal('dmv1LILaTX-12NIPKcK3BQ:1440921');
        log.should.have.property('elasticTaskStatus').and.be.an('object').and.deep.equal(elasticTaskResponseObject);

    });

    afterEach(() => {
        if (!nock.isDone()) {
            const pendingMocks = nock.pendingMocks();
            if (pendingMocks.length > 1) {
                throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
            }
        }
    });

    after(async () => {
        await Task.deleteMany({}).exec();
    });
});
