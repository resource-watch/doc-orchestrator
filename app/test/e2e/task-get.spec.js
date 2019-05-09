/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const Task = require('models/task.model');
const { createTask, deserializeTask } = require('./utils');
const { getTestServer } = require('./test-server');

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

        Task.remove({}).exec();
    });

    it('Get a non-existent task should return 404', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .get(`/api/v1/doc-importer/task/${timestamp}`)
            .send();

        response.status.should.equal(404);
    });

    it('Get an existent task should return 200', async () => {
        const fakeTask = await new Task(createTask('SAVED', 'TASK_CREATE')).save();

        const response = await requester
            .get(`/api/v1/doc-importer/task/${fakeTask._id}`)
            .send();
        const task = deserializeTask(response);

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        task.should.have.property('datasetId').and.equal(fakeTask.datasetId);
        task.should.have.property('logs').and.be.an('array').and.have.lengthOf(0);
        task.should.have.property('reads').and.equal(0);
        task.should.have.property('writes').and.equal(0);
        task.should.have.property('message').and.be.an('object');
        task.should.have.property('status').and.equal(fakeTask.status);
        task.should.have.property('type').and.equal(fakeTask.type);
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
