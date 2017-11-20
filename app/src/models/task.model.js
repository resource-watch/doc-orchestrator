const mongoose = require('mongoose');
const uuidV4 = require('uuid/v4');
const Schema = mongoose.Schema;
const STATUS = require('app.constants').STATUS;
const TYPE = require('app.constants').TYPE;

const Task = new Schema({
    _id: { type: String, default: uuidV4 },
    type: { type: String, enum: TYPE, default: 'CREATE' },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: STATUS, default: 'init' },
    reads: { type: Number, min: 0 },
    writes: { type: Number, min: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', Task);
