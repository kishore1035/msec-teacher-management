import { Schema, model, Document, Types } from 'mongoose';

export interface ILeaveTypeConfig {
  leaveType: string;
  displayName: string;
  description?: string;
  annualQuota?: number; // Undefined or null means unlimited / not quota-bound
  allowCarryForward: boolean;
  maxCarryForwardDays?: number;
  allowHalfDay: boolean;
  allowPartialDay: boolean;
  requiresAttachment: boolean;
  requiresAttachmentAfterDays?: number;
  minNoticeDays: number;
  maxConsecutiveDays?: number;
  isPaid: boolean;
  applicableCategories: string[];
}

export interface ILeaveApprovalWorkflow {
  requiresApproval: boolean;
  approverRoles: string[];
  preventSelfApproval: boolean;
  autoApproveTypes: string[];
}

export interface ILeaveCancellationRules {
  allowPendingCancellation: boolean;
  allowApprovedCancellationBeforeStart: boolean;
  allowAdminCancelAnytime: boolean;
}

export interface ILeavePolicy extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  academicYear?: Types.ObjectId;
  leaveTypes: ILeaveTypeConfig[];
  approvalWorkflow: ILeaveApprovalWorkflow;
  cancellationRules: ILeaveCancellationRules;
  applicableEmploymentCategories: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leaveTypeConfigSchema = new Schema<ILeaveTypeConfig>(
  {
    leaveType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    annualQuota: {
      type: Number,
      min: 0,
    },
    allowCarryForward: {
      type: Boolean,
      default: false,
    },
    maxCarryForwardDays: {
      type: Number,
      min: 0,
    },
    allowHalfDay: {
      type: Boolean,
      default: true,
    },
    allowPartialDay: {
      type: Boolean,
      default: true,
    },
    requiresAttachment: {
      type: Boolean,
      default: false,
    },
    requiresAttachmentAfterDays: {
      type: Number,
      min: 1,
    },
    minNoticeDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxConsecutiveDays: {
      type: Number,
      min: 1,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    applicableCategories: {
      type: [String],
      default: ['regular', 'contract', 'visiting', 'adjunct', 'probationary'],
    },
  },
  { _id: false }
);

const leavePolicySchema = new Schema<ILeavePolicy>(
  {
    name: {
      type: String,
      required: [true, 'Leave policy name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      index: true,
    },
    leaveTypes: {
      type: [leaveTypeConfigSchema],
      default: [],
    },
    approvalWorkflow: {
      requiresApproval: { type: Boolean, default: true },
      approverRoles: {
        type: [String],
        default: ['Super Admin', 'Admin'],
      },
      preventSelfApproval: { type: Boolean, default: true },
      autoApproveTypes: {
        type: [String],
        default: [],
      },
    },
    cancellationRules: {
      allowPendingCancellation: { type: Boolean, default: true },
      allowApprovedCancellationBeforeStart: { type: Boolean, default: true },
      allowAdminCancelAnytime: { type: Boolean, default: true },
    },
    applicableEmploymentCategories: {
      type: [String],
      default: ['regular', 'contract', 'visiting', 'adjunct', 'probationary'],
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required'],
      index: true,
    },
    effectiveTo: {
      type: Date,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

leavePolicySchema.index({ isActive: 1, effectiveFrom: -1 });

export const LeavePolicy = model<ILeavePolicy>('LeavePolicy', leavePolicySchema);
