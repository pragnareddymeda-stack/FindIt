import mongoose from 'mongoose';

export const ROLES = ['USER', 'ADMIN'];
export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'USER', index: true },
    status: { type: String, enum: USER_STATUSES, default: 'ACTIVE' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export default mongoose.model('User', userSchema);
