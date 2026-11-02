import { Schema, model, Document, Types } from 'mongoose';

export interface IAcademicYear extends Document {
  _id: Types.ObjectId;
  year: string; // e.g. "2026-2027"
  startDate: Date;
  endDate: Date;
  semesterType: 'ODD' | 'EVEN';
  isCurrent: boolean;
  status: 'Active' | 'Archived';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const academicYearSchema = new Schema<IAcademicYear>(
  {
    year: {
      type: String,
      required: [true, 'Academic year name is required (e.g. 2026-2027)'],
      unique: true,
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    semesterType: {
      type: String,
      enum: ['ODD', 'EVEN'],
      required: [true, 'Semester type is required'],
      default: 'ODD',
    },
    isCurrent: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
      index: true,
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

// Pre-save validation: startDate must be before endDate
academicYearSchema.pre('validate', function (next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  next();
});

export const AcademicYear = model<IAcademicYear>('AcademicYear', academicYearSchema);
