"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
mongoose_1.default.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/petcare').then(() => {
    app_1.app.listen(+(process.env.PORT || 5000), () => console.log('PETCARE API on :' + (process.env.PORT || 5000)));
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
