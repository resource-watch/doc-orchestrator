const mongoose = require('mongoose');
const uuidV4 = require('uuid/v4');
const { task } = require('rw-doc-importer-messages');
const { TASK_STATUS } = require('app.constants');
const mongoosePaginate = require('mongoose-paginate');

const { Schema } = mongoose;
const { MESSAGE_TYPES } = task;

const Task = new Schema({
    _id: { type: String, default: uuidV4 },
    type: { type: String, enum: Object.keys(MESSAGE_TYPES), default: MESSAGE_TYPES.EXECUTION_CREATE },
    message: { type: Schema.Types.Mixed },
    status: { type: String, enum: Object.keys(TASK_STATUS), default: TASK_STATUS.INIT },
    filesProcessed: { type: Number, min: 0, default: 0 },
    reads: { type: Number, min: 0, default: 0 },
    writes: { type: Number, min: 0, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    index: { type: String, trim: true },
    elasticTaskId: { type: String, trim: true },
    datasetId: { type: String, trim: true },
    logs: [{ type: Schema.Types.Mixed }],
    error: { type: String, trim: true }
});

Task.plugin(mongoosePaginate);

module.exports = mongoose.model('Task', Task);
