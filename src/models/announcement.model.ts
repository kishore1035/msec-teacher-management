import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export const ANNOUNCEMENT_TYPES = [
  'general',
  'academic',
  'examination',
  'attendance',
  'assignment',
  'timetable',
  'event',
  'emergency',
  'other',
] as const;

export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const ANNOUNCEMENT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const TARGET_AUDIENCES = [
  'all',
  'teachers',
  'students',
  'parents',
  'administrators',
  'selected',
] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export interface IAnnouncementEditHistory {
  updatedBy: Types.ObjectId;
  updatedAt: Date;
  previousTitle: string;
  previousContent: string;
  previousPriority: AnnouncementPriority;
  previousStatus: AnnouncementStatus;
  changeNote?: string;
}

export interface IAnnouncementAuditEntry {
  action: 'created' | 'updated' | 'scheduled' | 'published' | 'archived' | 'expired';
  performedBy: Types.ObjectId;
  timestamp: Date;
  details?: string;
}

export interface IAnnouncement extends Document {
  _id: Types.ObjectId;
  title: string;
  content: string;
  summary?: string;
  announcementType: AnnouncementType;
  priority: AnnouncementPriority;
  targetAudience: TargetAudience;
  targetRoles?: string[];
  targetDepartments: Types.ObjectId[];
  targetClasses: Types.ObjectId[];
  targetSections: Types.ObjectId[];
  targetSubjects: Types.ObjectId[];
  specificRecipients: Types.ObjectId[];
  attachments: IAttachment[];
  publishAt?: Date;
  expiresAt?: Date;
  status: AnnouncementStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  publishedAt?: Date;
  resolvedRecipientsSnapshot?: Types.ObjectId[];
  targetRecipientCount: number;
  isMandatory: boolean;
  editHistory: IAnnouncementEditHistory[];
  auditLog: IAnnouncementAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const announcementEditHistorySchema = new Schema<IAnnouncementEditHistory>(
  {
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now },
    previousTitle: { type: String, required: true },
    previousContent: { type: String, required: true },
    previousPriority: {
      type: String,
      enum: ANNOUNCEMENT_PRIORITIES,
      required: true,
    },
    previousStatus: {
      type: String,
      enum: ANNOUNCEMENT_STATUSES,
      required: true,
    },
    changeNote: { type: String, trim: true },
  },
  { _id: false }
);

const announcementAuditEntrySchema = new Schema<IAnnouncementAuditEntry>(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'scheduled', 'published', 'archived', 'expired'],
      required: true,
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, trim: true },
  },
  { _id: false }
);

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [300, 'Announcement title cannot exceed 300 characters'],
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required'],
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters'],
    },
    announcementType: {
      type: String,
      enum: ANNOUNCEMENT_TYPES,
      default: 'general',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ANNOUNCEMENT_PRIORITIES,
      default: 'normal',
      required: true,
      index: true,
    },
    targetAudience: {
      type: String,
      enum: TARGET_AUDIENCES,
      default: 'all',
      required: true,
      index: true,
    },
    targetRoles: [
      {
        type: String,
        trim: true,
      },
    ],
    targetDepartments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    targetClasses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Class',
      },
    ],
    targetSections: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Section',
      },
    ],
    targetSubjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    specificRecipients: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        select: false,
      },
    ],
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    publishAt: {
      type: Date,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ANNOUNCEMENT_STATUSES,
      default: 'draft',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user reference is required'],
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    resolvedRecipientsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      select: false,
      default: [],
    },
    targetRecipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    editHistory: {
      type: [announcementEditHistorySchema],
      default: [],
    },
    auditLog: {
      type: [announcementAuditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        delete ret['resolvedRecipientsSnapshot'];
        delete ret['specificRecipients'];
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Compound indexes for query efficiency, scheduling, expiry, and audience lookups
announcementSchema.index({ status: 1, priority: 1, createdAt: -1 });
announcementSchema.index({ status: 1, publishAt: 1 });
announcementSchema.index({ status: 1, expiresAt: 1 });
announcementSchema.index({ targetAudience: 1, status: 1, publishedAt: -1 });
announcementSchema.index({ targetSections: 1, status: 1 });
announcementSchema.index({ targetClasses: 1, status: 1 });
announcementSchema.index({ targetDepartments: 1, status: 1 });
announcementSchema.index({ targetSubjects: 1, status: 1 });
announcementSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
