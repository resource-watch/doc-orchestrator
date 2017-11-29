const logger = require('logger');
const ctRegisterMicroservice = require('ct-register-microservice-node');

class DatasetService {

    static async update(id, dataset) {
        logger.debug('Updating dataset');
        ctRegisterMicroservice.requestToMicroservice({
            uri: `/dataset/${id}`,
            method: 'PATCH',
            json: true,
            body: dataset
        });
    }

}

module.exports = DatasetService;
