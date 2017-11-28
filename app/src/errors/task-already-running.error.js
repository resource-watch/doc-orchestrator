class TaskAlreadyRunningError extends Error {

    constructor(message) {
        super(message);
        this.name = 'TaskAlreadyRunningError';
        this.message = message;
    }

}

module.exports = TaskAlreadyRunningError;
