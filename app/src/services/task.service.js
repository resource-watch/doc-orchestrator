const logger = require('logger');
const Task = require('models/task.model');
const TaskNotFound = require('errors/task-not-found.error');
const { TASK_STATUS } = require('app.constants');
const elasticService = require('services/elastic.service');

class TaskService {

    static getFilteredQuery(query) {
        const allowedSearchFields = {
            type: 'type',
            status: 'status',
            datasetId: 'datasetId',
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
            createdBefore: 'createdAt',
            createdAfter: 'createdAt',
            updatedBefore: 'updatedAt',
            updatedAfter: 'updatedAt'
        };
        const filteredQuery = {};

        logger.debug('Object.keys(query)', Object.keys(query));
        Object.keys(query).filter(param => Object.prototype.hasOwnProperty.call(allowedSearchFields, param)).forEach((param) => {
            switch (Task.schema.paths[allowedSearchFields[param]].instance) {

                case 'String':
                    filteredQuery[param] = {
                        $regex: query[param],
                        $options: 'i'
                    };
                    break;
                case 'Array':
                    if (query[param].indexOf('@') >= 0) {
                        filteredQuery[param] = {
                            $all: query[param].split('@').map(elem => elem.trim())
                        };
                    } else {
                        filteredQuery[param] = {
                            $in: query[param].split(',').map(elem => elem.trim())
                        };
                    }
                    break;
                case 'Mixed':
                    filteredQuery[param] = { $ne: null };
                    break;
                case 'Date':
                    filteredQuery[allowedSearchFields[param]] = filteredQuery[allowedSearchFields[param]] || {};
                    switch (param) {

                        case 'createdBefore':
                        case 'updatedBefore':
                            filteredQuery[allowedSearchFields[param]].$lte = new Date(query[param]);
                            break;
                        case 'createdAfter':
                        case 'updatedAfter':
                            filteredQuery[allowedSearchFields[param]].$gte = new Date(query[param]);
                            break;
                        default:
                            filteredQuery[allowedSearchFields[param]].$eq = new Date(query[param]);
                            break;

                    }
                    break;
                default:

            }
        });
        logger.debug(filteredQuery);
        return filteredQuery;
    }


    static async get(id) {
        logger.debug(`[TaskService]: Getting task with id: ${id}`);
        logger.debug(`[DBACCESS-FIND]: task.id: ${id}`);
        const task = await Task.findById(id).exec();
        if (!task) {
            logger.error(`[TaskService]: Task with id ${id} not found`);
            throw new TaskNotFound(`Task with id '${id}' not found`);
        }

        await Promise.all(task.logs.map(async (log, index) => {
            if (!log.elasticTaskId) {
                return Promise.resolve();
            }
            logger.debug(`[TaskRouter] Getting Elasticsearch task data for elasticsearchTaskIds: ${log.elasticTaskId}`);


            try {
                task.logs[index].elasticTaskStatus = await elasticService.getTaskStatus(log.elasticTaskId);
            } catch (err) {
                task.logs[index].elasticTaskStatus = err;
            }

            return Promise.resolve();
        }));

        return task;
    }

    static async create(taskData) {
        logger.debug(`[TaskService]: Creating new task of type ${taskData.type}`);
        const task = await new Task({
            _id: taskData.id,
            type: taskData.type,
            message: taskData,
            fileCount: taskData.fileUrl.length,
            reads: 0,
            writes: 0,
            datasetId: taskData.datasetId
        }).save();
        return task;
    }

    static async update(id, taskData) {
        logger.debug(`[TaskService]: Updating task with id:  ${id}`);
        let task = await TaskService.get(id);
        task.status = taskData.status || task.status;
        task.index = taskData.index || task.index;
        task.elasticTaskId = taskData.elasticTaskId || task.elasticTaskId;
        task.error = taskData.error || task.error;
        if (taskData.log && taskData.log instanceof Object) {
            task.logs.push(taskData.log);
        }
        task.updatedAt = new Date();
        logger.debug(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async resetCounters(id) {
        logger.debug(`[TaskService]: ResetCounters of task with id:  ${id}`);
        let task = await TaskService.get(id);
        task.reads = 0;
        task.writes = 0;
        logger.debug(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async delete(id) {
        logger.debug(`[TaskService]: Deleting task with id:  ${id}`);
        let task = await TaskService.get(id);
        logger.debug(`[DBACCESS-REMOVE]: task.id ${id}`);
        task = await task.remove();
        return task;
    }

    static async getAll(query = {}) {
        logger.debug(`[TaskService]: Getting all tasks`);

        const page = query['page[number]'] ? parseInt(query['page[number]'], 10) : 1;
        const limit = query['page[size]'] ? parseInt(query['page[size]'], 10) : 10;

        const paginationOptions = {
            page,
            limit
        };

        const filteredQuery = TaskService.getFilteredQuery(Object.assign({}, query));
        const pages = await Task.paginate(filteredQuery, paginationOptions);

        await Promise.all(pages.docs.map(async (task) => {
            await Promise.all(task.logs.map(async (log, logIndex) => {
                if (!log.elasticTaskId) {
                    return Promise.resolve();
                }
                logger.debug(`[TaskRouter] Getting Elasticsearch task data for elasticsearchTaskIds: ${log.elasticTaskId}`);


                try {
                    task.logs[logIndex].elasticTaskStatus = await elasticService.getTaskStatus(log.elasticTaskId);
                } catch (err) {
                    task.logs[logIndex].elasticTaskStatus = err;
                }

                return Promise.resolve();
            }));
        }));

        return pages;
    }

    static async addWrite(id) {
        logger.debug(`[TaskService]: addWrite to task with id:  ${id}`);
        logger.debug(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.writes += 1;
        logger.debug(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async addRead(id) {
        logger.debug(`[TaskService]: addRead to task with id:  ${id}`);
        logger.debug(`[DBACCESS-FIND]: task.id: ${id}`);
        let task = await TaskService.get(id);
        task.reads += 1;
        logger.debug(`[DBACCESS-SAVE]: update task.id ${id}`);
        task = await task.save();
        return task;
    }

    static async checkCounter(task) {
        logger.debug(`[TaskService]: checking counter of task with id:  ${task.id}`);
        if ((task.writes - task.reads === 0) && (task.status === TASK_STATUS.READ)) {
            return true;
        }
        return false;
    }

    static async getRunningTasks(datasetId) {
        logger.debug(`[TaskService]: checking running task for datasetId:  ${datasetId}`);
        logger.debug(`[DBACCESS-FIND]: task.datasetId: ${datasetId}`);
        return Task.find({ datasetId, status: { $nin: [TASK_STATUS.SAVED, TASK_STATUS.ERROR] } }).exec();
    }

}

module.exports = TaskService;
