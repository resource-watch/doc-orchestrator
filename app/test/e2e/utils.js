const uuidV4 = require('uuid/v4');

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
        return response.body.data.map(e => e.attributes);
    }
    if (isObject(response.body.data)) {
        return response.body.data.attributes;
    }
    return response;
};

const createTask = (status, type, createdAt = new Date(), reads = 0) => {
    const uuid = uuidV4();

    return {
        _id: uuidV4(),
        status,
        reads,
        writes: 0,
        logs: [],
        type,
        createdAt,
        updatedAt: createdAt,
        message: {
            id: uuidV4(),
            type,
            datasetId: uuid,
            provider: 'csv',
            index: uuidV4()
        },
        index: uuidV4(),
        datasetId: uuid
    };
};

module.exports = {
    createTask,
    deserializeTask
};
