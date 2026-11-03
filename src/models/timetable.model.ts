import { Schema, model, Document, Types } from 'mongoose';

export type TimetableType = 'regular' | 'temporary' | 'examination' | 'special';
export type TimetableStatus = 'draft' | 'published' | 'archived';

export interface ITimetable extends Document {
  _id: Types.ObjectId;
  name: string;
  academicYear: Types.ObjectId;
  semester: number;
  department: Types.ObjectId;
  class: Types.ObjectId;
  section: Types.ObjectId;
  effectiveFrom: Date;
  effectiveTo: Date;
  timetableType: TimetableType;
  status: TimetableStatus;
  version: number;
  createdBy: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const timetableSchema = new Schema<ITimetable>(
  {
    name: {
      type: String,
      required: [true, 'Timetable name is required'],
      trim: true,
      maxlength: [120, 'Timetable name cannot exceed 120 characters'],
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be between 1 and 8'],
      max: [8, 'Semester must be between 1 and 8'],
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
      index: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section is required'],
      index: true,
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required'],
      index: true,
    },
    effectiveTo: {
      type: Date,
      required: [true, 'Effective to date is required'],
      index: true,
    },
    timetableType: {
      type: String,
      enum: ['regular', 'temporary', 'examination', 'special'],
      default: 'regular',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

timetableSchema.index({ section: 1, effectiveFrom: 1, effectiveTo: 1, status: 1 });
timetableSchema.index({ academicYear: 1, semester: 1, section: 1 });

export const Timetable = model<ITimetable>('Timetable', timetableSchema);
