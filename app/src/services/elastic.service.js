const logger = require('logger');
const config = require('config');
const { Client } = require('@elastic/elasticsearch');

const elasticUrl = config.get('elasticsearch.host');

class ElasticService {

    constructor() {
        const elasticSearchConfig = {
            node: elasticUrl,
            log: 'info',
            apiVersion: 'sql'
        };

        if (config.get('elasticsearch.user') && config.get('elasticsearch.password')) {
            elasticSearchConfig.auth = {
                username: config.get('elasticsearch.user'),
                password: config.get('elasticsearch.password')
            };
        }

        this.client = new Client(elasticSearchConfig);

        logger.debug(`Pinging Elasticsearch server at ${elasticUrl}`);
        this.client.ping({
        }, (error) => {
            if (error) {
                logger.error(`Elasticsearch cluster is down! - ${error.message}`);
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
