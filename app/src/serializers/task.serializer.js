
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

    static serialize(data) {
        const result = {};
        if (data && Array.isArray(data) && data.length === 0) {
            result.data = [];
            return result;
        }
        if (data) {
            if (data.docs) {
                result.data = data.docs.map(el => TaskSerializer.serializeElement(el));
            } else {
                if (Array.isArray(data)) {
                    result.data = data.map(e => TaskSerializer.serializeElement(e));
                } else {
                    result.data = TaskSerializer.serializeElement(data);
                }
            }
        }
        return result;
    }

}

module.exports = TaskSerializer;
