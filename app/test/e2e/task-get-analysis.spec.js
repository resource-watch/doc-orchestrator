const nock = require('nock');
const chai = require('chai');
const Task = require('models/task.model');
const { task } = require('rw-doc-importer-messages');
const appConstants = require('app.constants');
const { ROLES } = require('./utils/test.constants');
const { createTask } = require('./utils/helpers');
const { getTestServer } = require('./utils/test-server');

chai.should();

let requester;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Task get analysis tests', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        requester = await getTestServer();

        await Task.deleteMany({}).exec();
    });

    it('Get analysis for a task without a user should return 403', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .get(`/api/v1/doc-importer/task/${timestamp}/analysis`)
            .send();

        response.status.should.equal(403);
    });

    it('Get analysis for a task with a user with role USER should return 403', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .get(`/api/v1/doc-importer/task/${timestamp}/analysis`)
            .query({
                loggedUser: JSON.stringify(ROLES.USER)
            })
            .send();

        response.status.should.equal(403);
    });

    it('Get analysis for a task with a user with role MANAGER should return 403', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .get(`/api/v1/doc-importer/task/${timestamp}/analysis`)
            .query({
                loggedUser: JSON.stringify(ROLES.MANAGER)
            })
            .send();

        response.status.should.equal(403);
    });

    it('Get analysis for a non-existent task should return 404', async () => {
        const timestamp = new Date().getTime();
        const response = await requester
            .get(`/api/v1/doc-importer/task/${timestamp}/analysis`)
            .query({
                loggedUser: JSON.stringify(ROLES.ADMIN)
            })
            .send();

        response.status.should.equal(404);
    });

    it('Get analysis for an existing task should return 200 (happy case)', async () => {
        const fakeTask = await new Task(createTask({
            status: appConstants.TASK_STATUS.SAVED,
            type: task.MESSAGE_TYPES.TASK_CREATE
        })).save();

        const response = await requester
            .get(`/api/v1/doc-importer/task/${fakeTask._id}/analysis`)
            .query({
                loggedUser: JSON.stringify(ROLES.ADMIN)
            })
            .send();

        response.status.should.equal(200);
        response.body.should.have.property('originalURLCount').and.equal(2);
        response.body.should.have.property('filesProcessedOnTask').and.equal(0);
        response.body.should.have.property('readsOnTask').and.equal(0);
        response.body.should.have.property('writesOnTask').and.equal(0);
        response.body.should.have.property('readFileCount').and.equal(0);
        response.body.should.have.property('readDataCount').and.equal(0);
        response.body.should.have.property('writtenDataCount').and.equal(0);
        response.body.should.have.property('fileDataCount').and.equal(2);

        response.body.should.have.property('fileData').and.deep.equal({
            'https://example.com/file1.json': {
                readFile: 0,
                readData: 0,
                writtenData: 0,
                mismatchingReads: [],
                mismatchingWrites: []
            },
            'https://example.com/file2.json': {
                readFile: 0,
                readData: 0,
                writtenData: 0,
                mismatchingReads: [],
                mismatchingWrites: []
            }
        });
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
