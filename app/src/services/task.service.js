const logger = require('logger');
const Task = require('models/task.model');
const TaskNotFound = require('errors/task-not-found.error');

class TaskService {

    static async get(id) {
        logger.debug(`[TaskService]: Getting task with id: ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        const task = await Task.findById(id).exec();
        if (!task) {
            logger.error(`[TaskService]: Task with id ${id} not found`);
            throw new TaskNotFound(`Task with id '${id}' not found`);
        }
        return task;
    }

    static async create(taskData) {
        logger.debug(`[TaskService]: Creating task`);
        logger.info(`[DBACCESS-SAVE]: new ${taskData.type} task`);
        const task = await new Task({
            type: taskData.name,
            status: taskData.status,
            message: taskData.message,
            reads: 0,
            writes: 0
        }).save();
        return task;
    }

    static async update(id, taskData) {
        logger.debug(`[TaskService]: Getting task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.reads = taskData.reads || task.reads;
        task.writes = taskData.writes || task.writes;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }
    static async delete(id) {
        logger.debug(`[TaskService]: Getting task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        logger.info(`[DBACCESS-REMOVE]: task.id ${id}`);
        task = await task.remove();
        return task;
    }

    static async getAll(query = {}) {
        logger.debug(`[TaskService]: Getting all tasks`);
        logger.info(`[DBACCESS-FIND]: tasks`);
        const tasks = await Task.find(query);
        return tasks;
    }

}

module.exports = TaskService;
