import { Schema, model } from 'mongoose';
const T = { timestamps: true };
const ref = (r: string) => ({ type: Schema.Types.ObjectId, ref: r, required: true, index: true });
const oid = (r: string) => ({ type: Schema.Types.ObjectId, ref: r });
export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false }, role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true }, resetHash: { type: String, select: false }, resetExp: { type: Date, select: false } }, T));
export const Pet = model('Pet', new Schema({ owner: ref('User'), name: { type: String, required: true },
  species: { type: String, enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Reptile', 'Other'], required: true },
  breed: String, gender: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' }, birthDate: Date, weight: Number,
  color: String, microchip: String, adoptionDate: Date, description: String, notes: String, photo: String }, T));
export const Health = model('Health', new Schema({ owner: ref('User'), pet: ref('Pet'),
  kind: { type: String, enum: ['vaccination', 'medical', 'medication', 'weight', 'appointment'], required: true },
  title: { type: String, required: true }, date: Date, nextDate: Date, endDate: Date, vet: String, clinic: String, value: Number,
  schedule: String, document: String, status: { type: String, enum: ['scheduled', 'done', 'cancelled'], default: 'scheduled' }, notes: String }, T));
export const CareTask = model('CareTask', new Schema({ owner: ref('User'), pet: ref('Pet'), title: { type: String, required: true },
  category: { type: String, enum: ['Feeding', 'Walking', 'Grooming', 'Bathing', 'Medication', 'Cleaning', 'Training', 'Vet', 'Custom'], default: 'Custom' },
  dueAt: { type: Date, required: true, index: true }, repeat: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  description: String, done: { type: Boolean, default: false } }, T));
export const Listing = model('Listing', new Schema({ owner: ref('User'), name: { type: String, required: true },
  species: { type: String, required: true }, breed: String, age: Number, gender: String, location: { type: String, required: true },
  description: String, contact: { type: String, required: true }, photo: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'adopted'], default: 'pending', index: true } }, T));
export const AdoptionRequest = model('AdoptionRequest', new Schema({ listing: ref('Listing'), requester: ref('User'), message: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' } }, T));
export const Post = model('Post', new Schema({ owner: ref('User'), type: { type: String, enum: ['Photo', 'Story', 'Question', 'Advice', 'Experience', 'Announcement'], default: 'Story' },
  caption: { type: String, required: true, maxlength: 2000 }, photo: String, petName: String, hidden: { type: Boolean, default: false },
  likes: [oid('User')], comments: [{ owner: oid('User'), text: { type: String, required: true, maxlength: 500 }, createdAt: { type: Date, default: Date.now } }] }, T));
export const Report = model('Report', new Schema({ post: ref('Post'), reporter: ref('User'), reason: { type: String, required: true }, resolved: { type: Boolean, default: false } }, T));
export const Product = model('Product', new Schema({ name: { type: String, required: true }, description: String,
  category: { type: String, enum: ['Pet Food', 'Toys', 'Accessories', 'Grooming', 'Health and Hygiene', 'Beds and Furniture', 'Training Products'], required: true },
  price: { type: Number, required: true, min: 0 }, stock: { type: Number, default: 0, min: 0 }, rating: { type: Number, min: 0, max: 5, default: 4 }, photo: String,
  active: { type: Boolean, default: true } }, T));
export const Cart = model('Cart', new Schema({ user: { ...ref('User'), unique: true }, items: [{ product: oid('Product'), qty: { type: Number, min: 1 } }] }, T));
export const Favorite = model('Favorite', new Schema({ user: ref('User'), product: ref('Product') }, T).index({ user: 1, product: 1 }, { unique: true }));
export const Order = model('Order', new Schema({ user: ref('User'), items: [{ product: oid('Product'), name: String, price: Number, qty: Number }],
  total: Number, demo: { type: Boolean, default: true }, status: { type: String, enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'placed' } }, T));
export const AIConversation = model('AIConversation', new Schema({ user: ref('User'), messages: [{ role: String, content: String }] }, T));
