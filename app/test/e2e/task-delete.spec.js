/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const Task = require('models/task.model');
const appConstants = require('app.constants');
const { task } = require('rw-doc-importer-messages');
const { ROLES } = require('./utils/test.constants');
const { createTask, deserializeTask } = require('./utils/helpers');
const { getTestServer } = require('./utils/test-server');

chai.should();

let requester;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Task delete tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestServer();

        await Task.deleteMany({}).exec();
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
        const fakeTask = await new Task(createTask({
            status: appConstants.TASK_STATUS.SAVED,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();

        const response = await requester
            .delete(`/api/v1/doc-importer/task/${fakeTask._id}?loggedUser=${JSON.stringify(ROLES.ADMIN)}`)
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

    afterEach(() => {
        if (!nock.isDone()) {
            const pendingMocks = nock.pendingMocks();
            nock.cleanAll();
            throw new Error(`Not all nock interceptors were used: ${pendingMocks}`);
        }
    });

    after(async () => {
        await Task.deleteMany({}).exec();
    });
});
