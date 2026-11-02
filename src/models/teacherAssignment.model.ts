import { Schema, model, Document, Types } from 'mongoose';

export interface ITeacherAssignment extends Document {
  _id: Types.ObjectId;
  teacher: Types.ObjectId;
  subject: Types.ObjectId;
  section: Types.ObjectId;
  academicYear: Types.ObjectId;
  semester: number;
  isPrimary: boolean;
  assignedBy?: Types.ObjectId;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
}

const teacherAssignmentSchema = new Schema<ITeacherAssignment>(
  {
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
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
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic Year reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester number is required'],
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Archived'],
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

// Compound index to prevent duplicate active assignments
teacherAssignmentSchema.index(
  { teacher: 1, subject: 1, section: 1, academicYear: 1, status: 1 },
  { unique: true }
);

export const TeacherAssignment = model<ITeacherAssignment>('TeacherAssignment', teacherAssignmentSchema);
