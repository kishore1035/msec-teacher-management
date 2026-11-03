import { Schema, model, Document, Types } from 'mongoose';

export type ProgressTrend = 'improving' | 'declining' | 'stable' | 'irregular';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface IRiskIndicator {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  scoreContribution: number;
}

export interface IStudentProgress extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  academicYear: Types.ObjectId;
  semester: number;
  section: Types.ObjectId;
  subject?: Types.ObjectId; // null or undefined indicates class-wide overall progress
  attendancePercentage: number;
  assignmentCompletionRate: number;
  assignmentAverageMarks: number;
  iaMarks: number;
  examinationMarks: number;
  overallAcademicPercentage: number;
  previousAcademicPerformance?: number;
  currentAcademicPerformance: number;
  progressTrend: ProgressTrend;
  riskLevel: RiskLevel;
  riskScore: number;
  riskIndicators: IRiskIndicator[];
  isSnapshot: boolean;
  snapshotDate: Date;
  notes?: string;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const riskIndicatorSchema = new Schema<IRiskIndicator>(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    scoreContribution: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const studentProgressSchema = new Schema<IStudentProgress>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
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
      required: [true, 'Section reference is required'],
      index: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
      index: true,
    },
    attendancePercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    assignmentCompletionRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    assignmentAverageMarks: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    iaMarks: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    examinationMarks: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    overallAcademicPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    previousAcademicPerformance: {
      type: Number,
      default: null,
    },
    currentAcademicPerformance: {
      type: Number,
      required: true,
      default: 0,
    },
    progressTrend: {
      type: String,
      enum: ['improving', 'declining', 'stable', 'irregular'],
      default: 'stable',
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
      index: true,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    riskIndicators: {
      type: [riskIndicatorSchema],
      default: [],
    },
    isSnapshot: {
      type: Boolean,
      default: false,
      index: true,
    },
    snapshotDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// For active tracking (1 unique non-snapshot per student/year/semester/subject):
studentProgressSchema.index(
  { student: 1, academicYear: 1, semester: 1, subject: 1, isSnapshot: 1 },
  { unique: true, partialFilterExpression: { isSnapshot: false } }
);

// For historical snapshots lookup:
studentProgressSchema.index({ student: 1, isSnapshot: 1, snapshotDate: -1 });

// For section/academic analytics queries:
studentProgressSchema.index({ section: 1, academicYear: 1, semester: 1, isSnapshot: 1 });
studentProgressSchema.index({ riskLevel: 1, section: 1 });

export const StudentProgress = model<IStudentProgress>('StudentProgress', studentProgressSchema);
