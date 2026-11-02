import { Schema, model, Document, Types } from 'mongoose';

export type ScheduleStatus = 'scheduled' | 'rescheduled' | 'completed' | 'cancelled';

export interface IExaminationSchedule extends Document {
  _id: Types.ObjectId;
  examination: Types.ObjectId;
  subject: Types.ObjectId;
  section: Types.ObjectId;
  examDate: Date;
  startTime: string; // e.g. "09:30"
  endTime: string;   // e.g. "12:30"
  venue: string;
  invigilators: Types.ObjectId[];
  instructions?: string;
  status: ScheduleStatus;
  rescheduleReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examinationScheduleSchema = new Schema<IExaminationSchedule>(
  {
    examination: {
      type: Schema.Types.ObjectId,
      ref: 'Examination',
      required: [true, 'Examination reference is required'],
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
    examDate: {
      type: Date,
      required: [true, 'Examination date is required'],
      index: true,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (e.g. 09:30)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (e.g. 12:30)'],
      trim: true,
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
    },
    invigilators: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Teacher',
      },
    ],
    instructions: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'rescheduled', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    rescheduleReason: {
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

// Compound Unique Index: Prevent overlapping exam slots for the same section
examinationScheduleSchema.index(
  { section: 1, examDate: 1, startTime: 1 },
  { unique: true }
);

examinationScheduleSchema.index({ examination: 1, subject: 1 });
examinationScheduleSchema.index({ invigilators: 1 });

export const ExaminationSchedule = model<IExaminationSchedule>(
  'ExaminationSchedule',
  examinationScheduleSchema
);
