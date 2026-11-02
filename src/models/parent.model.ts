import { Schema, model, Document, Types } from 'mongoose';

export interface IParent extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  fatherName?: string;
  motherName?: string;
  primaryPhone: string;
  alternatePhone?: string;
  students: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const parentSchema = new Schema<IParent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    fatherName: {
      type: String,
      trim: true,
    },
    motherName: {
      type: String,
      trim: true,
    },
    primaryPhone: {
      type: String,
      required: [true, 'Primary phone number is required'],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
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

parentSchema.index({ primaryPhone: 1 });

export const Parent = model<IParent>('Parent', parentSchema);
