const nock = require('nock');
const chai = require('chai');
const config = require('config');
const chaiHttp = require('chai-http');

let requester;

chai.use(chaiHttp);

const should = chai.should();

exports.getTestServer = async function getTestServer() {
    if (requester) {
        return requester;
    }

    const elasticUri = config.get('elasticsearch.host');

    process.on('unhandledRejection', (error) => {
        should.fail(error);
    });

    nock(elasticUri)
        .head('/')
        .times(999999)
        .reply(200);

    nock(process.env.CT_URL)
        .post(`/api/v1/microservice`)
        .reply(200);

    const serverPromise = require('../../../src/app');
    const { server } = await serverPromise();
    requester = chai.request(server).keepOpen();

    return requester;
};
