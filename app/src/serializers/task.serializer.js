
class TaskSerializer {

    static serializeElement(el, skipLogs) {
        const serializedElement = {
            id: el._id,
            type: 'task',
            attributes: {
                type: el.type,
                message: el.message,
                status: el.status,
                reads: el.reads,
                writes: el.writes,
                filesProcessed: el.filesProcessed,
                createdAt: el.createdAt,
                updatedAt: el.updatedAt,
                index: el.index,
                elasticTaskId: el.elasticTaskId,
                datasetId: el.datasetId,
                logs: el.logs,
                error: el.error
            }
        };

        if (skipLogs) {
            delete serializedElement.attributes.logs;
        }

        return serializedElement;
    }

    static serialize(data, link = null, skipLogs = false) {
        const result = {};
        if (data && Array.isArray(data) && data.length === 0) {
            result.data = [];
            return result;
        }
        if (data) {
            if (data.docs) {
                while (data.docs.indexOf(undefined) >= 0) {
                    data.docs.splice(data.docs.indexOf(undefined), 1);
                }
                result.data = data.docs.map(el => TaskSerializer.serializeElement(el, skipLogs));
            } else if (Array.isArray(data)) {
                result.data = data.map(e => TaskSerializer.serializeElement(e, skipLogs));
            } else {
                result.data = TaskSerializer.serializeElement(data, skipLogs);
            }
        }
        if (link) {
            result.links = {
                self: `${link}page[number]=${data.page}&page[size]=${data.limit}`,
                first: `${link}page[number]=1&page[size]=${data.limit}`,
                last: `${link}page[number]=${data.pages}&page[size]=${data.limit}`,
                prev: `${link}page[number]=${data.page - 1 > 0 ? data.page - 1 : data.page}&page[size]=${data.limit}`,
                next: `${link}page[number]=${data.page + 1 < data.pages ? data.page + 1 : data.pages}&page[size]=${data.limit}`,
            };
            result.meta = {
                'total-pages': data.pages,
                'total-items': data.total,
                size: data.limit
            };
        }
        return result;
    }


}

module.exports = TaskSerializer;
