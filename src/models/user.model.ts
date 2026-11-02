import { Schema, model, Document, Types } from 'mongoose';
import { ALL_ROLES, ROLES, UserRole } from '../constants/roles.constant';
import { hashPassword, comparePassword } from '../utils/password';

export interface IRefreshTokenSession {
  sessionId: string;
  tokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  refreshTokens: IRefreshTokenSession[];
  comparePassword(candidate: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshTokenSession>(
  {
    sessionId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ALL_ROLES,
        message: '{VALUE} is not a valid institutional role',
      },
      required: [true, 'Role is required'],
      default: ROLES.TEACHER,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
    refreshTokens: {
      type: [refreshTokenSchema],
      select: false,
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['password'];
        delete ret['refreshTokens'];
        delete ret['__v'];
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['password'];
        delete ret['refreshTokens'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Hash password before save if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    this.password = await hashPassword(this.password);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return comparePassword(candidate, this.password);
};

export const User = model<IUser>('User', userSchema);
