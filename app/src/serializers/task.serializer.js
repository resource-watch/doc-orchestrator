
class TaskSerializer {

    static serializeElement(el) {
        return {
            id: el._id,
            type: 'task',
            attributes: {
                name: el.name,
            }
        };
    }

    static serialize(data) {
        const result = {};
        if (data) {
            if (data.docs) {
                result.data = data.docs.map(el => TaskSerializer.serializeElement(el));
            } else {
                if (Array.isArray(data)) {
                    result.data = TaskSerializer.serializeElement(data[0]);
                } else {
                    result.data = TaskSerializer.serializeElement(data);
                }
            }
        }
        return result;
    }

}

module.exports = TaskSerializer;
