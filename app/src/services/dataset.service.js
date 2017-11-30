const logger = require('logger');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const STATUS = require('app.constants').STATUS;

class DatasetService {

    static async update(id, dataset) {
        logger.debug('Updating dataset');
        if (dataset.status === STATUS.SAVED) {
            dataset.status = 1;
        } else if (dataset.status === STATUS.ERROR) {
            dataset.status = 2;
        } else {
            dataset.status = 0;
        }
        await ctRegisterMicroservice.requestToMicroservice({
            uri: `/dataset/${id}`,
            method: 'PATCH',
            json: true,
            body: dataset
        });
    }

}

module.exports = DatasetService;
