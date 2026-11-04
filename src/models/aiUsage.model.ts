import mongoose, { Document, Schema, Types } from 'mongoose';
import { AIContentType } from './aiGeneratedContent.model';

export type AIUsageStatus = 'success' | 'failure' | 'rate_limited' | 'blocked';

export interface IAIUsageLog extends Document {
  user: Types.ObjectId;
  role: string;
  provider: string;
  modelName: string;
  requestType: AIContentType | string;
  subject?: Types.ObjectId;
  section?: Types.ObjectId;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  status: AIUsageStatus;
  errorCategory?: string;
  errorMessage?: string;
  generatedContentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aiUsageLogSchema = new Schema<IAIUsageLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true, index: true },
    provider: { type: String, required: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    requestType: { type: String, required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
    section: { type: Schema.Types.ObjectId, ref: 'Section' },
    promptTokens: { type: Number, default: 0, min: 0 },
    completionTokens: { type: Number, default: 0, min: 0 },
    totalTokens: { type: Number, default: 0, min: 0 },
    durationMs: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['success', 'failure', 'rate_limited', 'blocked'],
      required: true,
      index: true,
    },
    errorCategory: { type: String, trim: true },
    errorMessage: { type: String, trim: true },
    generatedContentId: { type: Schema.Types.ObjectId, ref: 'AIGeneratedContent' },
  },
  {
    timestamps: true,
  }
);

aiUsageLogSchema.index({ user: 1, createdAt: -1 });
aiUsageLogSchema.index({ status: 1, createdAt: -1 });
aiUsageLogSchema.index({ requestType: 1, createdAt: -1 });

export const AIUsageLog = mongoose.model<IAIUsageLog>('AIUsageLog', aiUsageLogSchema);

export interface IAIUsagePolicy extends Document {
  name: string;
  scope: 'institution' | 'role' | 'user';
  targetRole?: string;
  targetUser?: Types.ObjectId;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  maxInputChars: number;
  allowedContentTypes: AIContentType[];
  requireReviewBeforePublish: boolean;
  isActive: boolean;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const aiUsagePolicySchema = new Schema<IAIUsagePolicy>(
  {
    name: { type: String, required: true, trim: true },
    scope: {
      type: String,
      enum: ['institution', 'role', 'user'],
      default: 'role',
      required: true,
    },
    targetRole: {
      type: String,
      enum: [
        'Super Admin',
        'Admin',
        'Teacher',
        'Student',
        'Parent',
        'super_admin',
        'admin',
        'teacher',
        'student',
        'parent',
      ],
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dailyRequestLimit: { type: Number, required: true, min: 0, default: 50 },
    monthlyRequestLimit: { type: Number, required: true, min: 0, default: 1000 },
    dailyTokenLimit: { type: Number, required: true, min: 0, default: 50000 },
    monthlyTokenLimit: { type: Number, required: true, min: 0, default: 500000 },
    maxInputChars: { type: Number, required: true, min: 100, default: 12000 },
    allowedContentTypes: {
      type: [String],
      default: [
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
    },
    requireReviewBeforePublish: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

aiUsagePolicySchema.index({ scope: 1, targetRole: 1, targetUser: 1, isActive: 1 });

export const AIUsagePolicy = mongoose.model<IAIUsagePolicy>('AIUsagePolicy', aiUsagePolicySchema);
