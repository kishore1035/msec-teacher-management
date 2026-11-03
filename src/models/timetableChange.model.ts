import { Schema, model, Document, Types } from 'mongoose';
import { DayOfWeek } from './timetableEntry.model';

export type TimetableChangeType =
  | 'cancellation'
  | 'rescheduling'
  | 'substitution'
  | 'classroom_change'
  | 'temporary_override';

export type ChangeStatus = 'pending' | 'approved' | 'rejected';

export interface ITimetableChange extends Document {
  _id: Types.ObjectId;
  timetable: Types.ObjectId;
  entry: Types.ObjectId;
  changeType: TimetableChangeType;
  effectiveDate: Date;
  originalTeacher?: Types.ObjectId;
  substituteTeacher?: Types.ObjectId;
  originalClassroom?: string;
  newClassroom?: string;
  originalStartTime?: string;
  newStartTime?: string;
  originalEndTime?: string;
  newEndTime?: string;
  originalDayOfWeek?: DayOfWeek;
  newDayOfWeek?: DayOfWeek;
  originalPeriodNumber?: number;
  newPeriodNumber?: number;
  reason: string;
  status: ChangeStatus;
  requestedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timetableChangeSchema = new Schema<ITimetableChange>(
  {
    timetable: {
      type: Schema.Types.ObjectId,
      ref: 'Timetable',
      required: [true, 'Timetable reference is required'],
      index: true,
    },
    entry: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableEntry',
      required: [true, 'Timetable entry reference is required'],
      index: true,
    },
    changeType: {
      type: String,
      enum: [
        'cancellation',
        'rescheduling',
        'substitution',
        'classroom_change',
        'temporary_override',
      ],
      required: [true, 'Change type is required'],
      index: true,
    },
    effectiveDate: {
      type: Date,
      required: [true, 'Effective date is required'],
      index: true,
    },
    originalTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
    },
    substituteTeacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
    },
    originalClassroom: {
      type: String,
      trim: true,
    },
    newClassroom: {
      type: String,
      trim: true,
    },
    originalStartTime: {
      type: String,
      trim: true,
    },
    newStartTime: {
      type: String,
      trim: true,
    },
    originalEndTime: {
      type: String,
      trim: true,
    },
    newEndTime: {
      type: String,
      trim: true,
    },
    originalDayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    newDayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    originalPeriodNumber: {
      type: Number,
    },
    newPeriodNumber: {
      type: Number,
    },
    reason: {
      type: String,
      required: [true, 'Reason for change is required'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester reference is required'],
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

timetableChangeSchema.index({ entry: 1, effectiveDate: 1, status: 1 });
timetableChangeSchema.index({ substituteTeacher: 1, effectiveDate: 1 });

export const TimetableChange = model<ITimetableChange>('TimetableChange', timetableChangeSchema);
