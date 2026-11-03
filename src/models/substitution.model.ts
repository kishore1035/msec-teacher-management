import { Schema, model, Document, Types } from 'mongoose';
import { DayOfWeek } from './timetableEntry.model';

export type SubstitutionStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export interface ISubstitutionCompletionDetails {
  completedAt: Date;
  completedBy: Types.ObjectId;
  topicsCovered?: string;
  remarks?: string;
  attendanceRecorded?: boolean;
}

export interface ISubstitutionAuditEntry {
  action: 'proposed' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  actor: Types.ObjectId;
  actorRole: string;
  comments?: string;
  timestamp: Date;
}

export interface ISubstitution extends Document {
  _id: Types.ObjectId;
  timetable: Types.ObjectId;
  timetableEntry: Types.ObjectId;
  leaveRequest?: Types.ObjectId;
  absentTeacher: Types.ObjectId;
  substituteTeacher: Types.ObjectId;
  date: Date;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject?: Types.ObjectId;
  section: Types.ObjectId;
  classroom: string;
  reason: string;
  status: SubstitutionStatus;
  assignedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  approvalComments?: string;
  rejectionReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  completionDetails?: ISubstitutionCompletionDetails;
  timetableChange?: Types.ObjectId;
  notifyParents: boolean;
  auditHistory: ISubstitutionAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const substitutionCompletionSchema = new Schema<ISubstitutionCompletionDetails>(
  {
    completedAt: { type: Date, required: true, default: Date.now },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    topicsCovered: { type: String, trim: true },
    remarks: { type: String, trim: true },
    attendanceRecorded: { type: Boolean, default: false },
  },
  { _id: false }
);

const substitutionAuditSchema = new Schema<ISubstitutionAuditEntry>(
  {
    action: {
      type: String,
      enum: ['proposed', 'approved', 'rejected', 'completed', 'cancelled'],
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    comments: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const substitutionSchema = new Schema<ISubstitution>(
  {
    timetable: {
      type: Schema.Types.ObjectId,
      ref: 'Timetable',
      required: [true, 'Timetable reference is required'],
      index: true,
    },
    timetableEntry: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableEntry',
      required: [true, 'Original timetable entry reference is required'],
      index: true,
    },
    leaveRequest: {
      type: Schema.Types.ObjectId,
      ref: 'TeacherLeave',
      index: true,
    },
    absentTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Absent teacher reference is required'],
      index: true,
    },
    substituteTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Substitute teacher reference is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Substitution date is required'],
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      required: true,
    },
    periodNumber: {
      type: Number,
      required: [true, 'Period number is required'],
      min: 1,
      max: 12,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      index: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section reference is required'],
      index: true,
    },
    classroom: {
      type: String,
      required: [true, 'Classroom is required'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Substitution reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'rejected', 'completed', 'cancelled'],
      default: 'proposed',
      index: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned by user reference is required'],
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    approvalComments: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    completionDetails: {
      type: substitutionCompletionSchema,
    },
    timetableChange: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableChange',
    },
    notifyParents: {
      type: Boolean,
      default: false,
    },
    auditHistory: {
      type: [substitutionAuditSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

substitutionSchema.index({ substituteTeacher: 1, date: 1, status: 1 });
substitutionSchema.index({ absentTeacher: 1, date: 1, status: 1 });
substitutionSchema.index({ timetableEntry: 1, date: 1, status: 1 });
substitutionSchema.index({ section: 1, date: 1, periodNumber: 1 });

export const Substitution = model<ISubstitution>('Substitution', substitutionSchema);
