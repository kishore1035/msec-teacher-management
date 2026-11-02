import { Schema, model, Document, Types } from 'mongoose';

export type AssignmentType =
  | 'homework'
  | 'project'
  | 'practical'
  | 'presentation'
  | 'research'
  | 'other';

export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';

export interface IAttachment {
  _id?: Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
}

export interface IAssignment extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  instructions?: string;
  academicYear: Types.ObjectId;
  semester: number;
  section: Types.ObjectId;
  subject: Types.ObjectId;
  teacher: Types.ObjectId;
  assignmentType: AssignmentType;
  totalMarks: number;
  passingMarks: number;
  assignedDate: Date;
  dueDate: Date;
  allowLateSubmission: boolean;
  lateSubmissionDeadline?: Date;
  maxResubmissions: number;
  attachments: IAttachment[];
  status: AssignmentStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const attachmentSchema = new Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const assignmentSchema = new Schema<IAssignment>(
  {
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
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
      required: [true, 'Subject reference is required'],
      index: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      index: true,
    },
    assignmentType: {
      type: String,
      enum: ['homework', 'project', 'practical', 'presentation', 'research', 'other'],
      default: 'homework',
      index: true,
    },
    totalMarks: {
      type: Number,
      required: [true, 'Total marks is required'],
      min: [1, 'Total marks must be at least 1'],
    },
    passingMarks: {
      type: Number,
      required: [true, 'Passing marks is required'],
      min: [0, 'Passing marks cannot be negative'],
    },
    assignedDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    allowLateSubmission: {
      type: Boolean,
      default: false,
    },
    lateSubmissionDeadline: {
      type: Date,
    },
    maxResubmissions: {
      type: Number,
      default: 1,
      min: 0,
    },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'archived'],
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

// Compound indexes for optimal queries and dashboard performance
assignmentSchema.index({ section: 1, subject: 1, status: 1 });
assignmentSchema.index({ teacher: 1, status: 1 });
assignmentSchema.index({ academicYear: 1, semester: 1 });

export const Assignment = model<IAssignment>('Assignment', assignmentSchema);
