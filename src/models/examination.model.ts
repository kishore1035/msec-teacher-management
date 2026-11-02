import { Schema, model, Document, Types } from 'mongoose';

export type ExaminationType =
  | 'IA1'
  | 'IA2'
  | 'IA3'
  | 'semester'
  | 'practical'
  | 'supplementary'
  | 'other';

export type ExaminationStatus =
  | 'draft'
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'published'
  | 'cancelled';

export interface IExamination extends Document {
  _id: Types.ObjectId;
  name: string;
  examinationCode: string;
  examinationType: ExaminationType;
  academicYear: Types.ObjectId;
  semester: number;
  section?: Types.ObjectId;
  subject?: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  maximumMarks: number;
  passingMarks: number;
  duration: number; // Duration in minutes
  instructions?: string;
  status: ExaminationStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const examinationSchema = new Schema<IExamination>(
  {
    name: {
      type: String,
      required: [true, 'Examination name is required'],
      trim: true,
    },
    examinationCode: {
      type: String,
      required: [true, 'Examination code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    examinationType: {
      type: String,
      enum: ['IA1', 'IA2', 'IA3', 'semester', 'practical', 'supplementary', 'other'],
      required: [true, 'Examination type is required'],
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
      index: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      index: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    maximumMarks: {
      type: Number,
      required: [true, 'Maximum marks is required'],
      min: [1, 'Maximum marks must be greater than 0'],
    },
    passingMarks: {
      type: Number,
      required: [true, 'Passing marks is required'],
      min: [0, 'Passing marks cannot be negative'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [15, 'Duration must be at least 15 minutes'],
    },
    instructions: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'ongoing', 'completed', 'published', 'cancelled'],
      default: 'draft',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user reference is required'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

examinationSchema.index({ academicYear: 1, semester: 1 });
examinationSchema.index({ section: 1, subject: 1 });

export const Examination = model<IExamination>('Examination', examinationSchema);
