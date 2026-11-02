import { Schema, model, Document, Types } from 'mongoose';

export type ResultEvaluationStatus = 'pending' | 'evaluated' | 'verified' | 'published';

export interface IResultAudit {
  previousMarks?: number;
  newMarks: number;
  previousGrade?: string;
  newGrade?: string;
  changedBy: Types.ObjectId;
  reason: string;
  timestamp: Date;
}

export interface IExaminationResult extends Document {
  _id: Types.ObjectId;
  examination: Types.ObjectId;
  student: Types.ObjectId;
  subject: Types.ObjectId;
  academicYear: Types.ObjectId;
  semester: number;
  marksObtained?: number;
  maximumMarks: number;
  passingMarks: number;
  percentage?: number;
  grade?: string;
  gradePoint?: number;
  isPassed: boolean;
  isAbsent: boolean;
  isExempted: boolean;
  remarks?: string;
  evaluationStatus: ResultEvaluationStatus;
  evaluatedBy?: Types.ObjectId;
  evaluatedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  publishedAt?: Date;
  auditHistory: IResultAudit[];
  createdAt: Date;
  updatedAt: Date;
}

const resultAuditSchema = new Schema<IResultAudit>(
  {
    previousMarks: { type: Number },
    newMarks: { type: Number, required: true },
    previousGrade: { type: String },
    newGrade: { type: String },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const examinationResultSchema = new Schema<IExaminationResult>(
  {
    examination: {
      type: Schema.Types.ObjectId,
      ref: 'Examination',
      required: [true, 'Examination reference is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
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
    marksObtained: {
      type: Number,
      min: [0, 'Marks obtained cannot be negative'],
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
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    grade: {
      type: String,
      trim: true,
    },
    gradePoint: {
      type: Number,
      min: 0,
      max: 10,
    },
    isPassed: {
      type: Boolean,
      default: false,
    },
    isAbsent: {
      type: Boolean,
      default: false,
    },
    isExempted: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      trim: true,
    },
    evaluationStatus: {
      type: String,
      enum: ['pending', 'evaluated', 'verified', 'published'],
      default: 'pending',
      index: true,
    },
    evaluatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    evaluatedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    auditHistory: [resultAuditSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Unique Index: One result record per student per subject per examination
examinationResultSchema.index(
  { examination: 1, student: 1, subject: 1 },
  { unique: true }
);

examinationResultSchema.index({ student: 1, evaluationStatus: 1 });
examinationResultSchema.index({ examination: 1, evaluationStatus: 1 });
examinationResultSchema.index({ subject: 1, academicYear: 1 });

export const ExaminationResult = model<IExaminationResult>(
  'ExaminationResult',
  examinationResultSchema
);
