const logger = require('logger');

class DatasetService {

    static async updateStatus() {
        logger.debug('Updating dataset');
    }

    static async updateIndex() {
        logger.debug('Updating index of dataset');
    }

}

module.exports = DatasetService;
