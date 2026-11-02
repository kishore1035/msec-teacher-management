import { Schema, model, Document, Types } from 'mongoose';

export interface IAttendanceSession extends Document {
  _id: Types.ObjectId;
  academicYear: Types.ObjectId;
  section: Types.ObjectId;
  subject: Types.ObjectId;
  teacher: Types.ObjectId;
  date: Date;
  semester: number;
  periodNumber: number;
  startTime?: string;
  endTime?: string;
  sessionType: 'Regular' | 'Lab' | 'Extra' | 'Tutorial';
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  cancellationReason?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year reference is required'],
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
    date: {
      type: Date,
      required: [true, 'Session date is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: 1,
      max: 10,
    },
    periodNumber: {
      type: Number,
      required: [true, 'Period number is required'],
      min: 1,
      max: 10,
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    sessionType: {
      type: String,
      enum: ['Regular', 'Lab', 'Extra', 'Tutorial'],
      default: 'Regular',
      index: true,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled'],
      default: 'Scheduled',
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// Prevent duplicate sessions for same section, subject, date, and period
attendanceSessionSchema.index(
  { section: 1, subject: 1, date: 1, periodNumber: 1 },
  { unique: true }
);

attendanceSessionSchema.index({ teacher: 1, date: 1 });
attendanceSessionSchema.index({ section: 1, date: 1, status: 1 });

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', attendanceSessionSchema);
