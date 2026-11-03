import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export type MaterialType =
  | 'notes'
  | 'lecture'
  | 'presentation'
  | 'reference'
  | 'textbook'
  | 'question_paper'
  | 'syllabus'
  | 'video'
  | 'other';

export type MaterialVisibility = 'class' | 'subject' | 'institution';
export type MaterialStatus = 'draft' | 'published' | 'archived';

export interface IStudyMaterial extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  materialType: MaterialType;
  subject: Types.ObjectId;
  section?: Types.ObjectId;
  academicYear: Types.ObjectId;
  semester: number;
  teacher: Types.ObjectId;
  topic?: string;
  unit?: string;
  tags: string[];
  attachments: IAttachment[];
  visibility: MaterialVisibility;
  status: MaterialStatus;
  version: number;
  downloadCount: number;
  viewCount: number;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const studyMaterialSchema = new Schema<IStudyMaterial>(
  {
    title: {
      type: String,
      required: [true, 'Material title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Material description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    materialType: {
      type: String,
      enum: [
        'notes',
        'lecture',
        'presentation',
        'reference',
        'textbook',
        'question_paper',
        'syllabus',
        'video',
        'other',
      ],
      required: [true, 'Material type is required'],
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
      default: null,
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year reference is required'],
      index: true,
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 10,
      index: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      maxlength: [100, 'Topic cannot exceed 100 characters'],
    },
    unit: {
      type: String,
      trim: true,
      maxlength: [50, 'Unit cannot exceed 50 characters'],
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    visibility: {
      type: String,
      enum: ['class', 'subject', 'institution'],
      default: 'class',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Search text index
studyMaterialSchema.index(
  {
    title: 'text',
    description: 'text',
    topic: 'text',
    tags: 'text',
  },
  {
    weights: {
      title: 10,
      topic: 5,
      tags: 5,
      description: 2,
    },
    name: 'study_material_search_idx',
  }
);

// Compound filtering indexes
studyMaterialSchema.index({ subject: 1, section: 1, semester: 1, status: 1 });
studyMaterialSchema.index({ teacher: 1, status: 1 });
studyMaterialSchema.index({ academicYear: 1, semester: 1, status: 1 });

export const StudyMaterial = model<IStudyMaterial>('StudyMaterial', studyMaterialSchema);
