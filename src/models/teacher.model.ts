import { Schema, model, Document, Types } from 'mongoose';

export type EmploymentCategory =
  | 'regular'
  | 'contract'
  | 'visiting'
  | 'adjunct'
  | 'probationary';

export type TeacherEmploymentStatus = 'Active' | 'On Leave' | 'Resigned' | 'Retired' | 'Inactive';

export interface ITeacher extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  department: Types.ObjectId;
  designation: string;
  qualification: string;
  qualifications?: string[];
  specialization?: string[];
  joiningDate?: Date;
  employmentCategory?: EmploymentCategory;
  phone: string;
  alternatePhone?: string;
  address?: string;
  emergencyContact?: string;
  officeRoom?: string;
  bio?: string;
  profilePhotoUrl?: string;
  maxWeeklyHours?: number;
  isActive: boolean;
  status: TeacherEmploymentStatus;
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
      index: true,
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
      trim: true,
    },
    qualifications: {
      type: [String],
      default: [],
    },
    specialization: {
      type: [String],
      default: [],
      index: true,
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    employmentCategory: {
      type: String,
      enum: ['regular', 'contract', 'visiting', 'adjunct', 'probationary'],
      default: 'regular',
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      type: String,
      trim: true,
    },
    officeRoom: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    profilePhotoUrl: {
      type: String,
      trim: true,
    },
    maxWeeklyHours: {
      type: Number,
      default: 24,
      min: 1,
      max: 60,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'On Leave', 'Resigned', 'Retired', 'Inactive'],
      default: 'Active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

teacherSchema.virtual('fullName').get(function (this: ITeacher) {
  return `${this.firstName} ${this.lastName}`.trim();
});

export const Teacher = model<ITeacher>('Teacher', teacherSchema);

