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
        return response.body.data;
    }
    if (isObject(response.body.data)) {
        return response.body.data.attributes;
    }
    return response;
};

const getUUID = () => Math.random().toString(36).substring(7);

const createTask = (status, type) => {
    const uuid = getUUID();

    return {
        status,
        reads: 0,
        writes: 0,
        logs: [],
        type,
        message: {
            id: getUUID(),
            type,
            datasetId: uuid,
            provider: 'csv'
        },
        datasetId: uuid
    };
};

module.exports = {
    createTask,
    deserializeTask
};
