import { Schema, model, Document, Types } from 'mongoose';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type LectureType =
  | 'theory'
  | 'practical'
  | 'tutorial'
  | 'lab'
  | 'project'
  | 'break'
  | 'other';

export type EntryStatus = 'active' | 'cancelled' | 'rescheduled' | 'substituted';

export interface ITimetableEntry extends Document {
  _id: Types.ObjectId;
  timetable: Types.ObjectId;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "09:55"
  subject?: Types.ObjectId;
  teacher?: Types.ObjectId;
  additionalTeachers?: Types.ObjectId[];
  section: Types.ObjectId;
  classroom: string;
  lectureType: LectureType;
  academicYear: Types.ObjectId;
  semester: number;
  status: EntryStatus;
  isBreak: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timetableEntrySchema = new Schema<ITimetableEntry>(
  {
    timetable: {
      type: Schema.Types.ObjectId,
      ref: 'Timetable',
      required: [true, 'Timetable reference is required'],
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
      required: [true, 'Day of week is required'],
      index: true,
    },
    periodNumber: {
      type: Number,
      required: [true, 'Period number is required'],
      min: [1, 'Period number must be at least 1'],
      max: [12, 'Period number cannot exceed 12'],
      index: true,
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (e.g. 09:00)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (e.g. 09:55)'],
      trim: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      index: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      index: true,
    },
    additionalTeachers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Teacher',
      },
    ],
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section reference is required'],
      index: true,
    },
    classroom: {
      type: String,
      required: [true, 'Classroom / laboratory is required'],
      trim: true,
      index: true,
    },
    lectureType: {
      type: String,
      enum: ['theory', 'practical', 'tutorial', 'lab', 'project', 'break', 'other'],
      default: 'theory',
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'rescheduled', 'substituted'],
      default: 'active',
      index: true,
    },
    isBreak: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Indexes for fast queries & conflict detection
timetableEntrySchema.index({ timetable: 1, dayOfWeek: 1, periodNumber: 1 });
timetableEntrySchema.index({ teacher: 1, dayOfWeek: 1, startTime: 1, endTime: 1 });
timetableEntrySchema.index({ section: 1, dayOfWeek: 1, startTime: 1, endTime: 1 });
timetableEntrySchema.index({ classroom: 1, dayOfWeek: 1, startTime: 1, endTime: 1 });

export const TimetableEntry = model<ITimetableEntry>('TimetableEntry', timetableEntrySchema);
