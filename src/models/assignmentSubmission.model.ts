import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export type SubmissionStatus = 'submitted' | 'late' | 'resubmitted' | 'evaluated';
export type EvaluationStatus = 'pending' | 'evaluated' | 'returned';

export interface IEvaluationHistory {
  previousMarks?: number;
  newMarks: number;
  previousFeedback?: string;
  newFeedback?: string;
  evaluatedBy: Types.ObjectId;
  reason: string;
  timestamp: Date;
}

export interface IAssignmentSubmission extends Document {
  _id: Types.ObjectId;
  assignment: Types.ObjectId;
  student: Types.ObjectId;
  submissionText?: string;
  attachments: IAttachment[];
  submittedAt: Date;
  submissionStatus: SubmissionStatus;
  attemptNumber: number;
  isLate: boolean;
  evaluationStatus: EvaluationStatus;
  marksObtained?: number;
  feedback?: string;
  evaluatedBy?: Types.ObjectId;
  evaluatedAt?: Date;
  evaluationHistory: IEvaluationHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const evaluationHistorySchema = new Schema<IEvaluationHistory>(
  {
    previousMarks: { type: Number },
    newMarks: { type: Number, required: true },
    previousFeedback: { type: String },
    newFeedback: { type: String },
    evaluatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const assignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
  {
    assignment: {
      type: Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment reference is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    submissionText: {
      type: String,
      trim: true,
    },
    attachments: [attachmentSchema],
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    submissionStatus: {
      type: String,
      enum: ['submitted', 'late', 'resubmitted', 'evaluated'],
      default: 'submitted',
      index: true,
    },
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    evaluationStatus: {
      type: String,
      enum: ['pending', 'evaluated', 'returned'],
      default: 'pending',
      index: true,
    },
    marksObtained: {
      type: Number,
      min: [0, 'Marks obtained cannot be negative'],
    },
    feedback: {
      type: String,
      trim: true,
    },
    evaluatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    evaluatedAt: {
      type: Date,
    },
    evaluationHistory: [evaluationHistorySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Unique Index: One official submission document per student per assignment (supports resubmission versioning)
assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
assignmentSubmissionSchema.index({ student: 1, submissionStatus: 1 });
assignmentSubmissionSchema.index({ assignment: 1, evaluationStatus: 1 });

export const AssignmentSubmission = model<IAssignmentSubmission>(
  'AssignmentSubmission',
  assignmentSubmissionSchema
);
