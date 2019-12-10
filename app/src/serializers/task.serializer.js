
class TaskSerializer {

    static serializeElement(el) {
        return {
            id: el._id,
            type: 'task',
            attributes: {
                type: el.type,
                message: el.message,
                status: el.status,
                reads: el.reads,
                writes: el.writes,
                fileCount: el.fileCount,
                createdAt: el.createdAt,
                updatedAt: el.updatedAt,
                index: el.index,
                elasticTaskId: el.elasticTaskId,
                datasetId: el.datasetId,
                logs: el.logs,
                error: el.error
            }
        };
    }

    static serialize(data, link = null) {
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
                result.data = data.docs.map(el => TaskSerializer.serializeElement(el));
            } else if (Array.isArray(data)) {
                result.data = data.map(e => TaskSerializer.serializeElement(e));
            } else {
                result.data = TaskSerializer.serializeElement(data);
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
