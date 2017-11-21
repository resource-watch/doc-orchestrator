const mongoose = require('mongoose');
const uuidV4 = require('uuid/v4');
const Schema = mongoose.Schema;
const { task } = require('doc-importer-messages');
const MESSAGE_TYPES = task.MESSAGE_TYPES;
const STATUS = require('app.constants').STATUS;

const Task = new Schema({
    _id: { type: String, default: uuidV4 },
    type: { type: String, enum: Object.keys(MESSAGE_TYPES), default: MESSAGE_TYPES.EXECUTION_CREATE },
    message: { type: String, required: false, trim: true },
    status: { type: String, enum: Object.keys(STATUS), default: STATUS.init },
    reads: { type: Number, min: 0, default: 0 },
    writes: { type: Number, min: 0, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', Task);
