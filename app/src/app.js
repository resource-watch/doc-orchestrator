const logger = require('logger');

logger.debug('Initializing doc-orchestrator');
require('services/tasks-queue.service');
require('services/status-queue.service');
require('services/executor-task-queue.service');
