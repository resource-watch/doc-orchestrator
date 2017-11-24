const logger = require('logger');
const Task = require('models/task.model');
const TaskNotFound = require('errors/task-not-found.error');
const STATUS = require('app.constants').STATUS;

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
            _id: taskData.id,
            type: taskData.type,
            message: taskData,
            reads: 0,
            writes: 0
        }).save();
        return task;
    }

    static async update(id, taskData) {
        logger.debug(`[TaskService]: Updating task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.status = taskData.status || task.status;
        task.reads = taskData.reads || task.reads;
        task.writes = taskData.writes || task.writes;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }
    static async delete(id) {
        logger.debug(`[TaskService]: Deleting task with id:  ${id}`);
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

    static async addWrite(id) {
        logger.debug(`[TaskService]: addWrite to task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.writes += 1;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async addRead(id) {
        logger.debug(`[TaskService]: addRead to task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.reads += 1;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async updateStatus(id, status) {
        logger.debug(`[TaskService]: update status in task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.status = status;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async updateIndex(id, index) {
        logger.debug(`[TaskService]: update index in task with id:  ${id} and index: ${index}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.index = index;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async updateElasticTaskId(id, elasticTaskId) {
        logger.debug(`[TaskService]: update elasticTaskId in task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.elasticTaskId = elasticTaskId;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async updateError(id, error) {
        logger.debug(`[TaskService]: update error in task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.error = error;
        logger.info(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async checkCounter(id) {
        logger.debug(`[TaskService]: checking counter of task with id:  ${id}`);
        logger.info(`[DBACCESS-FIND]: task.id: ${id}`);
        const task = await TaskService.get(id);
        if ((task.writes - task.reads === 0) && (task.status === STATUS.READ)) {
            return true;
        }
        return false;
    }

}

module.exports = TaskService;
