const uuidV4 = require('uuid/v4');
const { task } = require('rw-doc-importer-messages');
const appConstants = require('app.constants');

function isArray(element) {
    if (element instanceof Array) {
        return true;
    }
    return false;
}

function isObject(property) {
    if (property instanceof Object && property.length === undefined) {
        return true;
    }
    return false;
}

const deserializeTask = (response) => {
    if (isArray(response.body.data)) {
        return response.body.data.map((e) => e.attributes);
    }
    if (isObject(response.body.data)) {
        return response.body.data.attributes;
    }
    return response;
};

const createTask = (additionalData) => {
    const uuid = uuidV4();

    return {
        _id: uuidV4(),
        status: appConstants.TASK_STATUS.INIT,
        reads: 0,
        writes: 0,
        files: 0,
        logs: [],
        type: task.MESSAGE_TYPES.TASK_CREATE,
        createdAt: new Date(),
        updatedAt: new Date(),
        message: {
            id: uuidV4(),
            type: additionalData.type || task.MESSAGE_TYPES.TASK_CREATE,
            datasetId: uuid,
            provider: 'csv',
            index: uuidV4(),
            fileUrl: ['https://example.com/file1.json', 'https://example.com/file2.json']
        },
        index: uuidV4(),
        datasetId: uuid,
        ...additionalData
    };
};

const validateTask = (responseTask, expectedTask, skipLogs = false) => {
    responseTask.should.have.property('datasetId').and.equal(expectedTask.datasetId);
    if (!skipLogs) {
        responseTask.should.have.property('logs').and.be.an('array').and.deep.equal(expectedTask.logs);
    } else {
        responseTask.should.not.have.property('logs');
    }
    responseTask.should.have.property('reads').and.equal(0);
    responseTask.should.have.property('writes').and.equal(0);
    responseTask.should.have.property('message').and.be.an('object');
    responseTask.should.have.property('status').and.equal(expectedTask.status);
    responseTask.should.have.property('type').and.equal(expectedTask.type);
};

module.exports = {
    createTask,
    deserializeTask,
    validateTask
};
