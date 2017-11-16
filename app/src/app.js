const logger = require('logger');
const TasksQueueService = require('services/tasksQueue.service');

logger.debug('Connecting to tasks queue');
let tasksQueue = new TasksQueueService();
