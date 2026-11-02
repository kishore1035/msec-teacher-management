import { Schema, model, Document, Types } from 'mongoose';

export interface IAttendanceCorrectionAudit {
  modifiedBy: Types.ObjectId;
  previousStatus: string;
  newStatus: string;
  reason: string;
  modifiedAt: Date;
}

export interface IAttendanceRecord extends Document {
  _id: Types.ObjectId;
  session: Types.ObjectId;
  student: Types.ObjectId;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  remarks?: string;
  markedBy: Types.ObjectId;
  markedAt: Date;
  lastModifiedBy?: Types.ObjectId;
  correctionReason?: string;
  auditHistory: IAttendanceCorrectionAudit[];
  createdAt: Date;
  updatedAt: Date;
}

const auditHistorySchema = new Schema<IAttendanceCorrectionAudit>(
  {
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    reason: { type: String, required: true },
    modifiedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: [true, 'Attendance session reference is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Excused'],
      required: [true, 'Attendance status is required'],
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    correctionReason: {
      type: String,
      trim: true,
    },
    auditHistory: {
      type: [auditHistorySchema],
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

// Compound unique index: Prevent duplicate attendance records for the same student within a session
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });
attendanceRecordSchema.index({ student: 1, status: 1 });

export const AttendanceRecord = model<IAttendanceRecord>('AttendanceRecord', attendanceRecordSchema);
