/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const Task = require('models/task.model');
const { ROLES } = require('./test.constants');
const { createTask, deserializeTask } = require('./utils');
const { getTestServer } = require('./test-server');

const should = chai.should();

let requester;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Task delete tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestServer();

        Task.remove({}).exec();
    });

    it('Delete a task without a user should return 403', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .delete(`/api/v1/doc-importer/task/${timestamp}`)
            .send();

        response.status.should.equal(403);
    });

    it('Delete a task with a user with role USER should return 403', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .delete(`/api/v1/doc-importer/task/${timestamp}?loggedUser=${JSON.stringify(ROLES.USER)}`)
            .send();

        response.status.should.equal(403);
    });

    it('Delete a non-existent task should return 404', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .delete(`/api/v1/doc-importer/task/${timestamp}?loggedUser=${JSON.stringify(ROLES.ADMIN)}`)
            .send();

        response.status.should.equal(404);
    });

    it('Delete an existent task should return 200', async () => {
        const fakeTask = await new Task(createTask('SAVED', 'TASK_CREATE')).save();

        const response = await requester
            .delete(`/api/v1/doc-importer/task/${fakeTask._id}?loggedUser=${JSON.stringify(ROLES.ADMIN)}`)
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
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });

    after(() => {
        Task.remove({}).exec();
    });
});
