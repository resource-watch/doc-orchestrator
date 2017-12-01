const Router = require('koa-router');
const logger = require('logger');
const TaskService = require('services/task.service');
const TaskSerializer = require('serializers/task.serializer');
const TaskNotFound = require('errors/task-not-found.error');

const router = new Router({
    prefix: '/doc-importer/task',
});

class TaskRouter {

    static async get(ctx) {
        const id = ctx.params.task;
        logger.info(`[TaskRouter] Getting task with id: ${id}`);
        try {
            const task = await TaskService.get(id);
            ctx.body = TaskSerializer.serialize(task);
        } catch (err) {
            if (err instanceof TaskNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

}

router.get('/:task', TaskRouter.get);

module.exports = router;
