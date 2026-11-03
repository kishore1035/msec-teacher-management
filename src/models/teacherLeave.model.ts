import { Schema, model, Document, Types } from 'mongoose';

export type LeaveType = string;

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type LeaveDayPart = 'full_day' | 'first_half' | 'second_half' | 'custom_hours';

export interface ILeaveAttachment {
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
}

export interface IAffectedTimetableSlot {
  timetableEntry: Types.ObjectId;
  timetable?: Types.ObjectId;
  date: Date;
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject?: Types.ObjectId;
  section?: Types.ObjectId;
  classroom?: string;
  substitution?: Types.ObjectId;
}

export interface ILeaveApprovalHistoryEntry {
  action: 'submitted' | 'approved' | 'rejected' | 'cancelled';
  actor: Types.ObjectId;
  actorRole: string;
  comments?: string;
  timestamp: Date;
}

export interface ITeacherLeave extends Document {
  _id: Types.ObjectId;
  teacher: Types.ObjectId;
  leavePolicy?: Types.ObjectId;
  academicYear?: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  leaveType: LeaveType;
  isPartialDay: boolean;
  dayPart: LeaveDayPart;
  startTime?: string;
  endTime?: string;
  startPeriod?: number;
  endPeriod?: number;
  totalDays: number;
  reason: string;
  attachments: ILeaveAttachment[];
  status: LeaveStatus;
  appliedDate: Date;
  approvedBy?: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewComments?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  affectedTimetableEntries: IAffectedTimetableSlot[];
  approvalHistory: ILeaveApprovalHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type ILeaveRequest = ITeacherLeave;

const leaveAttachmentSchema = new Schema<ILeaveAttachment>(
  {
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    fileType: { type: String, trim: true },
    fileSize: { type: Number },
  },
  { _id: false }
);

const affectedTimetableSlotSchema = new Schema<IAffectedTimetableSlot>(
  {
    timetableEntry: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableEntry',
      required: true,
    },
    timetable: {
      type: Schema.Types.ObjectId,
      ref: 'Timetable',
    },
    date: { type: Date, required: true },
    dayOfWeek: { type: String, required: true },
    periodNumber: { type: Number, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
    section: { type: Schema.Types.ObjectId, ref: 'Section' },
    classroom: { type: String },
    substitution: { type: Schema.Types.ObjectId, ref: 'Substitution' },
  },
  { _id: false }
);

const leaveApprovalHistorySchema = new Schema<ILeaveApprovalHistoryEntry>(
  {
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'cancelled'],
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

const teacherLeaveSchema = new Schema<ITeacherLeave>(
  {
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      index: true,
    },
    leavePolicy: {
      type: Schema.Types.ObjectId,
      ref: 'LeavePolicy',
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    leaveType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'casual',
      index: true,
    },
    isPartialDay: {
      type: Boolean,
      default: false,
    },
    dayPart: {
      type: String,
      enum: ['full_day', 'first_half', 'second_half', 'custom_hours'],
      default: 'full_day',
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    startPeriod: {
      type: Number,
      min: 1,
      max: 12,
    },
    endPeriod: {
      type: Number,
      min: 1,
      max: 12,
    },
    totalDays: {
      type: Number,
      default: 1,
      min: 0.25,
    },
    reason: {
      type: String,
      required: [true, 'Leave reason is required'],
      trim: true,
    },
    attachments: {
      type: [leaveAttachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'approved',
      index: true,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewComments: {
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
    affectedTimetableEntries: {
      type: [affectedTimetableSlotSchema],
      default: [],
    },
    approvalHistory: {
      type: [leaveApprovalHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

teacherLeaveSchema.index({ teacher: 1, startDate: 1, endDate: 1, status: 1 });
teacherLeaveSchema.index({ status: 1, startDate: 1 });

export const TeacherLeave = model<ITeacherLeave>('TeacherLeave', teacherLeaveSchema);
export const LeaveRequest = TeacherLeave;

