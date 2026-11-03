import { Schema, model, Document, Types } from 'mongoose';

export interface ITimetableConflictOverride extends Document {
  _id: Types.ObjectId;
  timetable: Types.ObjectId;
  entry?: Types.ObjectId;
  conflictType: string;
  conflictDetails: string;
  reason: string;
  overriddenBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timetableConflictOverrideSchema = new Schema<ITimetableConflictOverride>(
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
      index: true,
    },
    conflictType: {
      type: String,
      required: [true, 'Conflict type is required'],
      trim: true,
      index: true,
    },
    conflictDetails: {
      type: String,
      required: [true, 'Conflict details are required'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Override reason is required'],
      trim: true,
      minlength: [3, 'Override reason must be at least 3 characters'],
    },
    overriddenBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Overridden by user reference is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const TimetableConflictOverride = model<ITimetableConflictOverride>(
  'TimetableConflictOverride',
  timetableConflictOverrideSchema
);
