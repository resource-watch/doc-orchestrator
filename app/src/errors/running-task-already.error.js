class RunningTaskAlreadyError extends Error {

    constructor(message) {
        super(message);
        this.name = 'RunningTaskAlreadyError';
        this.message = message;
    }

}

module.exports = RunningTaskAlreadyError;
