const Router = require('koa-router');
const logger = require('logger');
const TaskService = require('services/task.service');
const TaskSerializer = require('serializers/task.serializer');
const TaskNotFound = require('errors/task-not-found.error');

const router = new Router({
    prefix: '/doc-importer/task',
});

const serializeObjToQuery = obj => Object.keys(obj).reduce((a, k) => {
    a.push(`${k}=${encodeURIComponent(obj[k])}`);
    return a;
}, []).join('&');

class TaskRouter {


    static getUser(ctx) {
        let user = Object.assign({}, ctx.request.query.loggedUser ? JSON.parse(ctx.request.query.loggedUser) : {}, ctx.request.body.loggedUser);
        if (ctx.request.body.fields) {
            user = Object.assign(user, JSON.parse(ctx.request.body.fields.loggedUser));
        }
        return user;
    }

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

    static async getAnalysis(ctx) {
        const id = ctx.params.task;
        logger.info(`[TaskRouter] Getting task analysis for id: ${id}`);
        try {
            const task = await TaskService.getAnalysis(id);

            ctx.body = task;
        } catch (err) {
            if (err instanceof TaskNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static async getAll(ctx) {
        logger.info(`[TaskRouter] Getting all tasks`);
        const { query } = ctx;

        if (parseInt(query['page[size]'], 10) > 100) {
            ctx.throw(400, 'Invalid page size');
        }

        try {
            const tasks = await TaskService.getAll(query);

            const clonedQuery = Object.assign({}, query);
            delete clonedQuery['page[size]'];
            delete clonedQuery['page[number]'];
            delete clonedQuery.ids;
            delete clonedQuery.loggedUser;
            const serializedQuery = serializeObjToQuery(clonedQuery) ? `?${serializeObjToQuery(clonedQuery)}&` : '?';
            const apiVersion = ctx.mountPath.split('/')[ctx.mountPath.split('/').length - 1];
            const link = `${ctx.request.protocol}://${ctx.request.host}/${apiVersion}${ctx.request.path}${serializedQuery}`;

            ctx.body = TaskSerializer.serialize(tasks, link);
        } catch (err) {
            if (err instanceof TaskNotFound) {
                ctx.throw(404, err.message);
                return;
            }
            throw err;
        }
    }

    static async delete(ctx) {
        const id = ctx.params.task;
        logger.info(`[TaskRouter] Deleting task with id: ${id}`);
        try {
            const task = await TaskService.delete(id);
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

const authorizationMiddleware = async (ctx, next) => {
    logger.info(`[Task Router] Checking authorization`);
    const user = TaskRouter.getUser(ctx);
    if (!user) {
        ctx.throw(401, 'Unauthorized');
        return;
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
        ctx.throw(403, 'Forbidden');
        return;
    }
    await next();
};


router.get('/', TaskRouter.getAll);
router.get('/:task', TaskRouter.get);
router.get('/:task/analysis', authorizationMiddleware, TaskRouter.getAnalysis);
router.delete('/:task', authorizationMiddleware, TaskRouter.delete);

module.exports = router;
