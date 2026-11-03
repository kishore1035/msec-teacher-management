import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export const PARENT_COMMUNICATION_TYPES = [
  'academic_progress',
  'attendance',
  'assignment',
  'examination',
  'general',
  'meeting_request',
  'other',
] as const;

export type ParentCommunicationType = (typeof PARENT_COMMUNICATION_TYPES)[number];

export const PARENT_COMMUNICATION_STATUSES = ['open', 'replied', 'closed'] as const;
export type ParentCommunicationStatus = (typeof PARENT_COMMUNICATION_STATUSES)[number];

export interface IMeetingDetails {
  requestedDates?: Date[];
  preferredMode?: 'in_person' | 'online' | 'phone';
  agenda?: string;
  scheduledAt?: Date;
  locationOrLink?: string;
  meetingStatus?: 'requested' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled';
}

export interface IParentCommunicationAudit {
  action: 'created' | 'message_added' | 'meeting_requested' | 'closed';
  performedBy: Types.ObjectId;
  timestamp: Date;
  details?: string;
}

export interface IParentCommunication extends Document {
  _id: Types.ObjectId;
  parent: Types.ObjectId;
  student: Types.ObjectId;
  teacher: Types.ObjectId;
  subject?: Types.ObjectId;
  section?: Types.ObjectId;
  initiatedBy: Types.ObjectId;
  initiatedByRole: string;
  communicationType: ParentCommunicationType;
  subjectLine: string;
  message: string;
  attachments: IAttachment[];
  status: ParentCommunicationStatus;
  meetingDetails?: IMeetingDetails;
  closedAt?: Date;
  closedBy?: Types.ObjectId;
  auditLog: IParentCommunicationAudit[];
  createdAt: Date;
  updatedAt: Date;
}

const meetingDetailsSchema = new Schema<IMeetingDetails>(
  {
    requestedDates: {
      type: [Date],
      default: [],
    },
    preferredMode: {
      type: String,
      enum: ['in_person', 'online', 'phone'],
      default: 'in_person',
    },
    agenda: {
      type: String,
      trim: true,
    },
    scheduledAt: {
      type: Date,
    },
    locationOrLink: {
      type: String,
      trim: true,
    },
    meetingStatus: {
      type: String,
      enum: ['requested', 'confirmed', 'rescheduled', 'completed', 'cancelled'],
      default: 'requested',
    },
  },
  { _id: false }
);

const communicationAuditSchema = new Schema<IParentCommunicationAudit>(
  {
    action: {
      type: String,
      enum: ['created', 'message_added', 'meeting_requested', 'closed'],
      required: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const parentCommunicationSchema = new Schema<IParentCommunication>(
  {
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Parent',
      required: [true, 'Parent reference is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      index: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      index: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      index: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    initiatedByRole: {
      type: String,
      required: true,
      trim: true,
    },
    communicationType: {
      type: String,
      enum: PARENT_COMMUNICATION_TYPES,
      default: 'general',
      required: true,
      index: true,
    },
    subjectLine: {
      type: String,
      required: [true, 'Subject line is required'],
      trim: true,
      maxlength: [300, 'Subject line cannot exceed 300 characters'],
    },
    message: {
      type: String,
      required: [true, 'Initial message is required'],
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: PARENT_COMMUNICATION_STATUSES,
      default: 'open',
      required: true,
      index: true,
    },
    meetingDetails: {
      type: meetingDetailsSchema,
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    auditLog: {
      type: [communicationAuditSchema],
      default: [],
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

parentCommunicationSchema.index({ parent: 1, status: 1, createdAt: -1 });
parentCommunicationSchema.index({ teacher: 1, status: 1, createdAt: -1 });
parentCommunicationSchema.index({ student: 1, createdAt: -1 });
parentCommunicationSchema.index({ communicationType: 1, status: 1, createdAt: -1 });

export const ParentCommunication = model<IParentCommunication>(
  'ParentCommunication',
  parentCommunicationSchema
);
