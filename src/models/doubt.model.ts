import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export const DOUBT_CATEGORIES = [
  'conceptual',
  'assignment',
  'examination',
  'practical',
  'administrative',
  'other',
] as const;

export type DoubtCategory = (typeof DOUBT_CATEGORIES)[number];

export const DOUBT_PRIORITIES = ['low', 'normal', 'high'] as const;
export type DoubtPriority = (typeof DOUBT_PRIORITIES)[number];

export const DOUBT_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'answered',
  'resolved',
  'closed',
] as const;

export type DoubtStatus = (typeof DOUBT_STATUSES)[number];

export interface IDoubtAssignmentHistory {
  previousTeacher?: Types.ObjectId;
  newTeacher: Types.ObjectId;
  assignedBy: Types.ObjectId;
  reason?: string;
  assignedAt: Date;
}

export interface IDoubtStatusHistory {
  previousStatus?: DoubtStatus;
  newStatus: DoubtStatus;
  changedBy: Types.ObjectId;
  reason?: string;
  changedAt: Date;
}

export interface IDoubt extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  student: Types.ObjectId;
  subject: Types.ObjectId;
  section: Types.ObjectId;
  academicYear: Types.ObjectId;
  semester: number;
  assignedTeacher?: Types.ObjectId;
  category: DoubtCategory;
  priority: DoubtPriority;
  status: DoubtStatus;
  topic?: string;
  tags: string[];
  attachments: IAttachment[];
  firstRespondedAt?: Date;
  answeredAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  reopenCount: number;
  lastReopenedAt?: Date;
  assignmentHistory: IDoubtAssignmentHistory[];
  statusHistory: IDoubtStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const doubtAssignmentHistorySchema = new Schema<IDoubtAssignmentHistory>(
  {
    previousTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    newTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const doubtStatusHistorySchema = new Schema<IDoubtStatusHistory>(
  {
    previousStatus: {
      type: String,
      enum: DOUBT_STATUSES,
    },
    newStatus: {
      type: String,
      enum: DOUBT_STATUSES,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const doubtSchema = new Schema<IDoubt>(
  {
    title: {
      type: String,
      required: [true, 'Doubt title is required'],
      trim: true,
      maxlength: [300, 'Doubt title cannot exceed 300 characters'],
    },
    description: {
      type: String,
      required: [true, 'Doubt description is required'],
      trim: true,
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
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section reference is required'],
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
      required: [true, 'Semester number is required'],
      min: 1,
      max: 10,
      index: true,
    },
    assignedTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
    },
    category: {
      type: String,
      enum: DOUBT_CATEGORIES,
      default: 'conceptual',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: DOUBT_PRIORITIES,
      default: 'normal',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: DOUBT_STATUSES,
      default: 'open',
      required: true,
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    firstRespondedAt: {
      type: Date,
    },
    answeredAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
    reopenCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReopenedAt: {
      type: Date,
    },
    assignmentHistory: {
      type: [doubtAssignmentHistorySchema],
      default: [],
    },
    statusHistory: {
      type: [doubtStatusHistorySchema],
      default: [],
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

doubtSchema.index({ student: 1, status: 1, createdAt: -1 });
doubtSchema.index({ assignedTeacher: 1, status: 1, createdAt: -1 });
doubtSchema.index({ subject: 1, section: 1, status: 1, createdAt: -1 });
doubtSchema.index({ academicYear: 1, semester: 1, status: 1 });
doubtSchema.index({ status: 1, createdAt: -1 });

export const Doubt = model<IDoubt>('Doubt', doubtSchema);
