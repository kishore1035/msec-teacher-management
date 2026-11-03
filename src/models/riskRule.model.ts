import { Schema, model, Document, Types } from 'mongoose';

export interface IRiskWeights {
  attendance: number;
  assignments: number;
  internalAssessments: number;
  examinations: number;
}

export interface IRiskScoreTiers {
  high: number;
  medium: number;
  low: number;
}

export interface IRiskRule extends Document {
  _id: Types.ObjectId;
  name: string;
  isDefault: boolean;
  academicYear?: Types.ObjectId;
  attendanceThreshold: number; // e.g. 75 (%)
  assignmentCompletionThreshold: number; // e.g. 60 (%)
  iaPassPercentageThreshold: number; // e.g. 40 (%)
  examPassPercentageThreshold: number; // e.g. 40 (%)
  consecutiveDeclinesThreshold: number; // e.g. 2
  failedSubjectsThreshold: number; // e.g. 2
  riskWeights: IRiskWeights;
  riskScoreTiers: IRiskScoreTiers;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const riskWeightsSchema = new Schema<IRiskWeights>(
  {
    attendance: { type: Number, required: true, default: 25 },
    assignments: { type: Number, required: true, default: 25 },
    internalAssessments: { type: Number, required: true, default: 25 },
    examinations: { type: Number, required: true, default: 25 },
  },
  { _id: false }
);

const riskScoreTiersSchema = new Schema<IRiskScoreTiers>(
  {
    high: { type: Number, required: true, default: 60 },
    medium: { type: Number, required: true, default: 30 },
    low: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const riskRuleSchema = new Schema<IRiskRule>(
  {
    name: {
      type: String,
      required: [true, 'Risk rule name is required'],
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      index: true,
    },
    attendanceThreshold: {
      type: Number,
      required: true,
      default: 75,
      min: 0,
      max: 100,
    },
    assignmentCompletionThreshold: {
      type: Number,
      required: true,
      default: 60,
      min: 0,
      max: 100,
    },
    iaPassPercentageThreshold: {
      type: Number,
      required: true,
      default: 40,
      min: 0,
      max: 100,
    },
    examPassPercentageThreshold: {
      type: Number,
      required: true,
      default: 40,
      min: 0,
      max: 100,
    },
    consecutiveDeclinesThreshold: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
    },
    failedSubjectsThreshold: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
    },
    riskWeights: {
      type: riskWeightsSchema,
      required: true,
      default: () => ({
        attendance: 25,
        assignments: 25,
        internalAssessments: 25,
        examinations: 25,
      }),
    },
    riskScoreTiers: {
      type: riskScoreTiersSchema,
      required: true,
      default: () => ({
        high: 60,
        medium: 30,
        low: 0,
      }),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

riskRuleSchema.index({ academicYear: 1, isDefault: 1 });

export const RiskRule = model<IRiskRule>('RiskRule', riskRuleSchema);
