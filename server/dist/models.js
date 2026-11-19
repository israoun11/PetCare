"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIConversation = exports.Order = exports.Favorite = exports.Cart = exports.Product = exports.Report = exports.Post = exports.AdoptionRequest = exports.Listing = exports.CareTask = exports.Health = exports.Pet = exports.User = void 0;
const mongoose_1 = require("mongoose");
const T = { timestamps: true };
const ref = (r) => ({ type: mongoose_1.Schema.Types.ObjectId, ref: r, required: true, index: true });
const oid = (r) => ({ type: mongoose_1.Schema.Types.ObjectId, ref: r });
exports.User = (0, mongoose_1.model)('User', new mongoose_1.Schema({
    name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false }, role: { type: String, enum: ['user', 'admin'], default: 'user' },
    active: { type: Boolean, default: true }, resetHash: { type: String, select: false }, resetExp: { type: Date, select: false }
}, T));
exports.Pet = (0, mongoose_1.model)('Pet', new mongoose_1.Schema({ owner: ref('User'), name: { type: String, required: true },
    species: { type: String, enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Reptile', 'Other'], required: true },
    breed: String, gender: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' }, birthDate: Date, weight: Number,
    color: String, microchip: String, adoptionDate: Date, description: String, notes: String, photo: String }, T));
exports.Health = (0, mongoose_1.model)('Health', new mongoose_1.Schema({ owner: ref('User'), pet: ref('Pet'),
    kind: { type: String, enum: ['vaccination', 'medical', 'medication', 'weight', 'appointment'], required: true },
    title: { type: String, required: true }, date: Date, nextDate: Date, endDate: Date, vet: String, clinic: String, value: Number,
    schedule: String, document: String, status: { type: String, enum: ['scheduled', 'done', 'cancelled'], default: 'scheduled' }, notes: String }, T));
exports.CareTask = (0, mongoose_1.model)('CareTask', new mongoose_1.Schema({ owner: ref('User'), pet: ref('Pet'), title: { type: String, required: true },
    category: { type: String, enum: ['Feeding', 'Walking', 'Grooming', 'Bathing', 'Medication', 'Cleaning', 'Training', 'Vet', 'Custom'], default: 'Custom' },
    dueAt: { type: Date, required: true, index: true }, repeat: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    description: String, done: { type: Boolean, default: false } }, T));
exports.Listing = (0, mongoose_1.model)('Listing', new mongoose_1.Schema({ owner: ref('User'), name: { type: String, required: true },
    species: { type: String, required: true }, breed: String, age: Number, gender: String, location: { type: String, required: true },
    description: String, contact: { type: String, required: true }, photo: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'adopted'], default: 'pending', index: true } }, T));
exports.AdoptionRequest = (0, mongoose_1.model)('AdoptionRequest', new mongoose_1.Schema({ listing: ref('Listing'), requester: ref('User'), message: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' } }, T));
exports.Post = (0, mongoose_1.model)('Post', new mongoose_1.Schema({ owner: ref('User'), type: { type: String, enum: ['Photo', 'Story', 'Question', 'Advice', 'Experience', 'Announcement'], default: 'Story' },
    caption: { type: String, required: true, maxlength: 2000 }, photo: String, petName: String, hidden: { type: Boolean, default: false },
    likes: [oid('User')], comments: [{ owner: oid('User'), text: { type: String, required: true, maxlength: 500 }, createdAt: { type: Date, default: Date.now } }] }, T));
exports.Report = (0, mongoose_1.model)('Report', new mongoose_1.Schema({ post: ref('Post'), reporter: ref('User'), reason: { type: String, required: true }, resolved: { type: Boolean, default: false } }, T));
exports.Product = (0, mongoose_1.model)('Product', new mongoose_1.Schema({ name: { type: String, required: true }, description: String,
    category: { type: String, enum: ['Pet Food', 'Toys', 'Accessories', 'Grooming', 'Health and Hygiene', 'Beds and Furniture', 'Training Products'], required: true },
    price: { type: Number, required: true, min: 0 }, stock: { type: Number, default: 0, min: 0 }, rating: { type: Number, min: 0, max: 5, default: 4 }, photo: String,
    active: { type: Boolean, default: true } }, T));
exports.Cart = (0, mongoose_1.model)('Cart', new mongoose_1.Schema({ user: { ...ref('User'), unique: true }, items: [{ product: oid('Product'), qty: { type: Number, min: 1 } }] }, T));
exports.Favorite = (0, mongoose_1.model)('Favorite', new mongoose_1.Schema({ user: ref('User'), product: ref('Product') }, T).index({ user: 1, product: 1 }, { unique: true }));
exports.Order = (0, mongoose_1.model)('Order', new mongoose_1.Schema({ user: ref('User'), items: [{ product: oid('Product'), name: String, price: Number, qty: Number }],
    total: Number, demo: { type: Boolean, default: true }, status: { type: String, enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'placed' } }, T));
exports.AIConversation = (0, mongoose_1.model)('AIConversation', new mongoose_1.Schema({ user: ref('User'), messages: [{ role: String, content: String }] }, T));
