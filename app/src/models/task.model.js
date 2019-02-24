const mongoose = require('mongoose');
const uuidV4 = require('uuid/v4');
const Schema = mongoose.Schema;
const { task } = require('rw-doc-importer-messages');
const MESSAGE_TYPES = task.MESSAGE_TYPES;
const STATUS = require('app.constants').STATUS;

const Task = new Schema({
    _id: { type: String, default: uuidV4 },
    type: { type: String, enum: Object.keys(MESSAGE_TYPES), default: MESSAGE_TYPES.EXECUTION_CREATE },
    message: { type: Schema.Types.Mixed },
    status: { type: String, enum: Object.keys(STATUS), default: STATUS.INIT },
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

module.exports = mongoose.model('Task', Task);
