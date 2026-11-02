import { Schema, model, Document, Types } from 'mongoose';

export interface ITeacher extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: Types.ObjectId;
  designation: string;
  qualification: string;
  phone: string;
  officeRoom?: string;
  status: 'Active' | 'On Leave' | 'Resigned' | 'Retired';
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacher>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
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
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    officeRoom: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'On Leave', 'Resigned', 'Retired'],
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

export const Teacher = model<ITeacher>('Teacher', teacherSchema);
