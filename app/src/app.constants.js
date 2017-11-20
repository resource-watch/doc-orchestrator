const STATUS_QUEUE = 'DOC-STATUS';
const TASKS_QUEUE = 'DOC-TASKS';
const EXECUTOR_TASK_QUEUE = 'DOC-EXECUTOR-TASKS';

const TYPE = ['CREATE', 'CONCAT', 'OVERWRITE', 'DELETE'];
const STATUS = ['init', 'pending', 'failed', 'saved'];

module.exports = {
    STATUS_QUEUE,
    TASKS_QUEUE,
    EXECUTOR_TASK_QUEUE,
    TYPE,
    STATUS
};
