import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export interface IStudyMaterialVersion extends Document {
  _id: Types.ObjectId;
  material: Types.ObjectId;
  versionNumber: number;
  title: string;
  description: string;
  topic?: string;
  unit?: string;
  tags: string[];
  attachments: IAttachment[];
  changeDescription: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
}

const studyMaterialVersionSchema = new Schema<IStudyMaterialVersion>(
  {
    material: {
      type: Schema.Types.ObjectId,
      ref: 'StudyMaterial',
      required: [true, 'Study material reference is required'],
      index: true,
    },
    versionNumber: {
      type: Number,
      required: [true, 'Version number is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    unit: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    changeDescription: {
      type: String,
      required: [true, 'Change description is required'],
      trim: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Compound unique index on material and versionNumber
studyMaterialVersionSchema.index({ material: 1, versionNumber: -1 }, { unique: true });

export const StudyMaterialVersion = model<IStudyMaterialVersion>(
  'StudyMaterialVersion',
  studyMaterialVersionSchema
);
