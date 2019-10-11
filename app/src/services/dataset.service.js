const logger = require('logger');
const ctRegisterMicroservice = require('ct-register-microservice-node');
const { DATASET_STATUS } = require('app.constants');

class DatasetService {

    static async update(id, dataset) {
        if (dataset.status === DATASET_STATUS.SAVED) {
            dataset.status = 1;
        } else if (dataset.status === DATASET_STATUS.ERROR) {
            dataset.status = 2;
        } else {
            dataset.status = 0;
        }
        logger.debug(`Updating dataset: ${JSON.stringify(dataset)}`);


        try {
            return await ctRegisterMicroservice.requestToMicroservice({
                uri: `/dataset/${id}`,
                method: 'PATCH',
                json: true,
                body: dataset
            });
        } catch (e) {
            logger.error('Error issuing request to the dataset microservice: ', e.message);
            throw new Error(e);
        }
    }

    static async get(id) {
        logger.debug(`Getting dataset with id: ${id}`);

        try {
            return await ctRegisterMicroservice.requestToMicroservice({
                uri: `/dataset/${id}`,
                method: 'GET',
                json: true
            });
        } catch (e) {
            logger.error('Error issuing request to the dataset microservice: ', e.message);
            throw new Error(e);
        }
    }

}

module.exports = DatasetService;
