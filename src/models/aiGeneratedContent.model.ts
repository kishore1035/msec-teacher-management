import mongoose, { Document, Schema, Types } from 'mongoose';

export type AIContentType =
  | 'lesson_plan'
  | 'topic_explanation'
  | 'quiz'
  | 'question_paper'
  | 'assignment'
  | 'teaching_material'
  | 'learning_outcomes'
  | 'rubric'
  | 'study_material_summary'
  | 'question_bank';

export type AIReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface IAIContentRevision {
  version: number;
  title: string;
  content: Record<string, any> | string;
  editedBy: Types.ObjectId;
  editNotes?: string;
  editedAt: Date;
}

export interface IAIContentApprovalEntry {
  action: 'submitted_for_review' | 'approved' | 'rejected' | 'converted_to_resource';
  actor: Types.ObjectId;
  comments?: string;
  timestamp: Date;
  publishedResource?: {
    resourceType: 'StudyMaterial' | 'Assignment';
    resourceId: Types.ObjectId;
  };
}

export interface IAIGeneratedContent extends Document {
  contentType: AIContentType;
  title: string;
  subject?: Types.ObjectId;
  class?: Types.ObjectId;
  section?: Types.ObjectId;
  academicYear?: Types.ObjectId;
  semester?: number;
  createdBy: Types.ObjectId;
  aiProvider: string;
  aiModel: string;
  promptTemplateVersion: string;
  inputParameters: Record<string, any>;
  inputReferences: {
    studyMaterials?: Types.ObjectId[];
    assignments?: Types.ObjectId[];
    examinations?: Types.ObjectId[];
  };
  generatedOutput: Record<string, any>;
  currentContent: Record<string, any>;
  revisionHistory: IAIContentRevision[];
  approvalHistory: IAIContentApprovalEntry[];
  reviewStatus: AIReviewStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewComments?: string;
  publishedResource?: {
    resourceType: 'StudyMaterial' | 'Assignment';
    resourceId: Types.ObjectId;
    publishedAt: Date;
  };
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const aiContentRevisionSchema = new Schema<IAIContentRevision>(
  {
    version: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: Schema.Types.Mixed, required: true },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    editNotes: { type: String, trim: true },
    editedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiContentApprovalSchema = new Schema<IAIContentApprovalEntry>(
  {
    action: {
      type: String,
      enum: ['submitted_for_review', 'approved', 'rejected', 'converted_to_resource'],
      required: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comments: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now },
    publishedResource: {
      resourceType: { type: String, enum: ['StudyMaterial', 'Assignment'] },
      resourceId: { type: Schema.Types.ObjectId },
    },
  },
  { _id: false }
);

const aiGeneratedContentSchema = new Schema<IAIGeneratedContent>(
  {
    contentType: {
      type: String,
      enum: [
        'lesson_plan',
        'topic_explanation',
        'quiz',
        'question_paper',
        'assignment',
        'teaching_material',
        'learning_outcomes',
        'rubric',
        'study_material_summary',
        'question_bank',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', index: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', index: true },
    section: { type: Schema.Types.ObjectId, ref: 'Section', index: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', index: true },
    semester: { type: Number, min: 1, max: 12 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    aiProvider: { type: String, required: true, trim: true },
    aiModel: { type: String, required: true, trim: true },
    promptTemplateVersion: { type: String, required: true, default: 'v1.0.0' },
    inputParameters: { type: Schema.Types.Mixed, default: {} },
    inputReferences: {
      studyMaterials: [{ type: Schema.Types.ObjectId, ref: 'StudyMaterial' }],
      assignments: [{ type: Schema.Types.ObjectId, ref: 'Assignment' }],
      examinations: [{ type: Schema.Types.ObjectId, ref: 'Examination' }],
    },
    generatedOutput: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },
    currentContent: {
      type: Schema.Types.Mixed,
      required: true,
    },
    revisionHistory: {
      type: [aiContentRevisionSchema],
      default: [],
    },
    approvalHistory: {
      type: [aiContentApprovalSchema],
      default: [],
    },
    reviewStatus: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewComments: { type: String, trim: true },
    publishedResource: {
      resourceType: { type: String, enum: ['StudyMaterial', 'Assignment'] },
      resourceId: { type: Schema.Types.ObjectId },
      publishedAt: { type: Date },
    },
    tokenUsage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

aiGeneratedContentSchema.index({ createdBy: 1, contentType: 1, reviewStatus: 1, createdAt: -1 });
aiGeneratedContentSchema.index({ subject: 1, section: 1, reviewStatus: 1 });

export const AIGeneratedContent = mongoose.model<IAIGeneratedContent>(
  'AIGeneratedContent',
  aiGeneratedContentSchema
);
