class TaskNotFound extends Error {

    constructor(message) {
        super(message);
        this.name = 'TaskNotFound';
        this.message = message;
    }

}

module.exports = TaskNotFound;
