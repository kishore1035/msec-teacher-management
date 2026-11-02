import { Schema, model, Document, Types } from 'mongoose';

export interface ISubjectModule {
  moduleNumber: number;
  title: string;
  topics: string[];
  description?: string;
}

export interface ISubject extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department: Types.ObjectId;
  semester: number;
  credits: number;
  subjectType: 'Theory' | 'Practical' | 'Elective' | 'Project';
  modules: ISubjectModule[];
  description?: string;
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

const subjectModuleSchema = new Schema<ISubjectModule>(
  {
    moduleNumber: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    topics: [{ type: String, trim: true }],
    description: { type: String, trim: true },
  },
  { _id: false }
);

const subjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: [1, 'Semester must be at least 1'],
      max: [10, 'Semester must be at most 10'],
      index: true,
    },
    credits: {
      type: Number,
      required: [true, 'Credits are required'],
      min: [1, 'Credits must be at least 1'],
      max: [10, 'Credits cannot exceed 10'],
    },
    subjectType: {
      type: String,
      enum: ['Theory', 'Practical', 'Elective', 'Project'],
      default: 'Theory',
      required: true,
      index: true,
    },
    modules: {
      type: [subjectModuleSchema],
      default: [],
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
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

export const Subject = model<ISubject>('Subject', subjectSchema);
