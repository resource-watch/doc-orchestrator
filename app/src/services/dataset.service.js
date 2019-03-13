const logger = require('logger');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const { STATUS } = require('app.constants');

class DatasetService {

    static async update(id, dataset) {
        if (dataset.status === STATUS.SAVED) {
            dataset.status = 1;
        } else if (dataset.status === STATUS.ERROR) {
            dataset.status = 2;
        } else {
            dataset.status = 0;
        }
        logger.debug(`Updating dataset: ${JSON.stringify(dataset)}`);

        await ctRegisterMicroservice.requestToMicroservice({
            uri: `/dataset/${id}`,
            method: 'PATCH',
            json: true,
            body: dataset
        });
    }

}

module.exports = DatasetService;
