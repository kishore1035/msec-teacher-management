import { Schema, model, Document, Types } from 'mongoose';

export interface ISection extends Document {
  _id: Types.ObjectId;
  class: Types.ObjectId;
  academicYear: Types.ObjectId;
  semester: number;
  sectionName: string;
  classTeacher?: Types.ObjectId;
  roomNumber?: string;
  capacity: number;
  status: 'Active' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic Year reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: [1, 'Semester must be between 1 and 10'],
      max: [10, 'Semester must be between 1 and 10'],
      index: true,
    },
    sectionName: {
      type: String,
      required: [true, 'Section name is required (e.g. A, B, C)'],
      uppercase: true,
      trim: true,
    },
    classTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      default: 60,
      min: [1, 'Section capacity must be at least 1'],
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
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

// Compound unique index: Prevent duplicate sections in the same class, academic year and semester
sectionSchema.index({ class: 1, academicYear: 1, semester: 1, sectionName: 1 }, { unique: true });

export const Section = model<ISection>('Section', sectionSchema);
