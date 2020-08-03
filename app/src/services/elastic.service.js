const logger = require('logger');
const config = require('config');
const { Client } = require('@elastic/elasticsearch');

const elasticUrl = config.get('elastic.url');

class ElasticService {

    constructor() {
        this.client = new Client({
            node: elasticUrl
        });

        logger.debug(`Pinging Elasticsearch server at ${elasticUrl}`);
        this.client.ping({
        }, (error) => {
            if (error) {
                logger.error('Elasticsearch cluster is down!');
                process.exit(1);
            }
        });
    }

    async getTaskStatus(taskId) {
        logger.debug(`Getting Elasticsearch task status from id ${taskId}`);

        return new Promise((resolve, reject) => {

            this.client.tasks.get({
                taskId
            }, (error, response) => {
                if (error) {
                    logger.info(`Could not load status info for Elasticsearch task with id ${taskId}`);
                    reject(error.meta.body);
                    return;
                }
                resolve(response.body);
            });
        });
    }

}

module.exports = new ElasticService();
