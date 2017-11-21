const STATUS_QUEUE = 'DOC-STATUS';
const TASKS_QUEUE = 'DOC-TASKS';
const EXECUTOR_TASK_QUEUE = 'DOC-EXECUTOR-TASKS';

// @TODO
const STATUS = {
    init: 'init',
    pending: 'pending',
    failed: 'failed',
    saved: 'saved'
};

module.exports = {
    STATUS_QUEUE,
    TASKS_QUEUE,
    EXECUTOR_TASK_QUEUE,
    STATUS
};
