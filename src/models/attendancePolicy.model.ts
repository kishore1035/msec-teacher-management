import { Schema, model, Document, Types } from 'mongoose';

export interface ISubjectThreshold {
  subject: Types.ObjectId;
  threshold: number;
}

export interface IAttendancePolicy extends Document {
  _id: Types.ObjectId;
  institutionThreshold: number;
  warningThreshold: number;
  subjectThresholds: ISubjectThreshold[];
  lateTreatment: 'Present' | 'CountAsHalf' | 'Absent';
  excusedTreatment: 'Present' | 'ExcludeFromTotal' | 'Absent';
  effectiveDate: Date;
  academicYear: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  status: 'Active' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
}

const subjectThresholdSchema = new Schema<ISubjectThreshold>(
  {
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
  },
  { _id: false }
);

const attendancePolicySchema = new Schema<IAttendancePolicy>(
  {
    institutionThreshold: {
      type: Number,
      required: [true, 'Institution shortage threshold is required'],
      default: 75,
      min: 1,
      max: 100,
    },
    warningThreshold: {
      type: Number,
      required: [true, 'Warning threshold is required'],
      default: 85,
      min: 1,
      max: 100,
    },
    subjectThresholds: {
      type: [subjectThresholdSchema],
      default: [],
    },
    lateTreatment: {
      type: String,
      enum: ['Present', 'CountAsHalf', 'Absent'],
      default: 'Present',
    },
    excusedTreatment: {
      type: String,
      enum: ['Present', 'ExcludeFromTotal', 'Absent'],
      default: 'ExcludeFromTotal',
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year reference is required'],
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
      index: true,
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

attendancePolicySchema.index({ academicYear: 1, status: 1 });

export const AttendancePolicy = model<IAttendancePolicy>('AttendancePolicy', attendancePolicySchema);
