import { Schema, model, Document, Types } from 'mongoose';

export interface IClass extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department: Types.ObjectId;
  degree: 'B.E.' | 'M.Tech' | 'MCA' | 'Other';
  durationYears: number;
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
    name: {
      type: String,
      required: [true, 'Class/Program name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Class code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    degree: {
      type: String,
      enum: ['B.E.', 'M.Tech', 'MCA', 'Other'],
      default: 'B.E.',
      required: [true, 'Degree type is required'],
    },
    durationYears: {
      type: Number,
      default: 4,
      min: [1, 'Duration must be at least 1 year'],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

export const Class = model<IClass>('Class', classSchema);
