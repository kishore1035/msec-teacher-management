import { Schema, model, Document, Types } from 'mongoose';

export interface IStudent extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  usn: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  gender?: 'Male' | 'Female' | 'Other';
  department: Types.ObjectId;
  class: Types.ObjectId;
  section: Types.ObjectId;
  semester: number;
  academicYear: Types.ObjectId;
  parent?: Types.ObjectId;
  parents?: Types.ObjectId[];
  phone?: string;
  status: 'Active' | 'Suspended' | 'Alumni' | 'Discontinued';
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    usn: {
      type: String,
      required: [true, 'USN is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
      index: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: 1,
      max: 10,
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year reference is required'],
      index: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Parent',
      default: null,
      index: true,
    },
    parents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Parent',
      },
    ],
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Alumni', 'Discontinued'],
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

studentSchema.index({ section: 1, status: 1 });
studentSchema.index({ class: 1, semester: 1 });

export const Student = model<IStudent>('Student', studentSchema);
