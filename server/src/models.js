import mongoose from 'mongoose';

const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model, required: true });

export const CATEGORIES = ['medical', 'salon', 'bank', 'government', 'repair', 'other'];

export const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'staff', 'admin'], default: 'user' },
}, { timestamps: true }));

// A Queue is a business ("shop") with one live queue. Shop profile fields live here too.
const queueSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  owner: ref('User'),
  avgServiceMinutes: { type: Number, default: 5, min: 0 },
  isOpen: { type: Boolean, default: true },
  counter: { type: Number, default: 0 },
  counterDate: String,
  currentToken: { type: Schema.Types.ObjectId, ref: 'Token', default: null },
  category: { type: String, enum: CATEGORIES, default: 'other' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  image: { type: String, default: '' },
  address: { street: String, city: String, state: String, pincode: String },
  hours: { open: { type: String, default: '09:00' }, close: { type: String, default: '18:00' } },
  services: [{ name: { type: String, required: true, trim: true }, minutes: { type: Number, default: 5, min: 0 } }],
  // GeoJSON Point [lng, lat]; absent until the vendor sets a location (2dsphere index skips docs without it)
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined },
  },
});
queueSchema.index({ location: '2dsphere' });
export const Queue = mongoose.model('Queue', queueSchema);

const tokenSchema = new Schema({
  queue: ref('Queue'),
  user: ref('User'),
  number: { type: Number, required: true },
  priority: { type: Boolean, default: false },
  service: { type: String, default: '' },
  status: { type: String, enum: ['waiting', 'serving', 'served', 'skipped', 'left'], default: 'waiting' },
  calledAt: Date,
  doneAt: Date,
}, { timestamps: true });
tokenSchema.index({ queue: 1, status: 1 });
tokenSchema.index({ queue: 1, user: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['waiting', 'serving'] } } });
export const Token = mongoose.model('Token', tokenSchema);

const appointmentSchema = new Schema({
  queue: ref('Queue'),
  user: ref('User'),
  at: { type: Date, required: true },
  service: { type: String, default: '' },
  note: { type: String, default: '' },
  status: { type: String, enum: ['booked', 'checked_in', 'cancelled', 'completed'], default: 'booked' },
  token: { type: Schema.Types.ObjectId, ref: 'Token', default: null },
}, { timestamps: true });
appointmentSchema.index({ queue: 1, at: 1 }, { unique: true, partialFilterExpression: { status: 'booked' } });
export const Appointment = mongoose.model('Appointment', appointmentSchema);
