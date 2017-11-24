const Router = require('koa-router');
const logger = require('logger');
const TaskService = require('services/task.service');

const router = new Router({
    prefix: '/task',
});

class TaskRouter {

    static async get(ctx) {
        logger.debug('getting task');
    }

}

router.get('/', TaskRouter.get);

module.exports = router;
