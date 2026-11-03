import { Schema, model, Document, Types } from 'mongoose';

export const PARENT_RELATIONSHIP_TYPES = ['father', 'mother', 'guardian', 'other'] as const;
export type ParentRelationshipType = (typeof PARENT_RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type RelationshipVerificationStatus = (typeof RELATIONSHIP_VERIFICATION_STATUSES)[number];

export interface IChildLink {
  student: Types.ObjectId;
  relationshipType: ParentRelationshipType;
  isPrimaryGuardian: boolean;
  verificationStatus: RelationshipVerificationStatus;
  linkedAt: Date;
  linkedBy?: Types.ObjectId;
}

export interface IParentRelationshipAudit {
  action: 'created' | 'linked' | 'unlinked' | 'verified' | 'updated';
  student?: Types.ObjectId;
  relationshipType?: ParentRelationshipType;
  verificationStatus?: RelationshipVerificationStatus;
  performedBy?: Types.ObjectId;
  reason?: string;
  timestamp: Date;
}

export interface IParent extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  relationshipType: ParentRelationshipType;
  primaryPhone: string;
  alternatePhone?: string;
  email?: string;
  occupation?: string;
  address?: string;
  verificationStatus: RelationshipVerificationStatus;
  students: Types.ObjectId[];
  childrenLinks: IChildLink[];
  relationshipHistory: IParentRelationshipAudit[];
  createdAt: Date;
  updatedAt: Date;
}

const childLinkSchema = new Schema<IChildLink>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    relationshipType: {
      type: String,
      enum: PARENT_RELATIONSHIP_TYPES,
      default: 'guardian',
    },
    isPrimaryGuardian: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: RELATIONSHIP_VERIFICATION_STATUSES,
      default: 'verified',
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    linkedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const parentRelationshipAuditSchema = new Schema<IParentRelationshipAudit>(
  {
    action: {
      type: String,
      enum: ['created', 'linked', 'unlinked', 'verified', 'updated'],
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
    },
    relationshipType: {
      type: String,
      enum: PARENT_RELATIONSHIP_TYPES,
    },
    verificationStatus: {
      type: String,
      enum: RELATIONSHIP_VERIFICATION_STATUSES,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const parentSchema = new Schema<IParent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    fatherName: {
      type: String,
      trim: true,
    },
    motherName: {
      type: String,
      trim: true,
    },
    guardianName: {
      type: String,
      trim: true,
    },
    relationshipType: {
      type: String,
      enum: PARENT_RELATIONSHIP_TYPES,
      default: 'guardian',
      index: true,
    },
    primaryPhone: {
      type: String,
      required: [true, 'Primary phone number is required'],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    occupation: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: RELATIONSHIP_VERIFICATION_STATUSES,
      default: 'verified',
      index: true,
    },
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        index: true,
      },
    ],
    childrenLinks: {
      type: [childLinkSchema],
      default: [],
    },
    relationshipHistory: {
      type: [parentRelationshipAuditSchema],
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

parentSchema.index({ primaryPhone: 1 });
parentSchema.index({ students: 1, verificationStatus: 1 });

export const Parent = model<IParent>('Parent', parentSchema);

