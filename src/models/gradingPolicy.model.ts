import { Schema, model, Document, Types } from 'mongoose';

export type IACalculationMethod = 'BEST_2_OF_3' | 'AVERAGE_ALL' | 'WEIGHTED';

export interface IGradeTier {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  description: string;
  isPassing: boolean;
}

export interface IGradingPolicy extends Document {
  _id: Types.ObjectId;
  academicYear?: Types.ObjectId;
  name: string;
  isDefault: boolean;
  iaCalculationMethod: IACalculationMethod;
  iaWeights?: {
    ia1: number;
    ia2: number;
    ia3: number;
  };
  minimumPassingPercentage: number;
  grades: IGradeTier[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const gradeTierSchema = new Schema<IGradeTier>(
  {
    grade: { type: String, required: true, trim: true },
    minPercentage: { type: Number, required: true, min: 0, max: 100 },
    maxPercentage: { type: Number, required: true, min: 0, max: 100 },
    gradePoint: { type: Number, required: true, min: 0, max: 10 },
    description: { type: String, required: true },
    isPassing: { type: Boolean, required: true, default: true },
  },
  { _id: false }
);

const gradingPolicySchema = new Schema<IGradingPolicy>(
  {
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Grading policy name is required'],
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    iaCalculationMethod: {
      type: String,
      enum: ['BEST_2_OF_3', 'AVERAGE_ALL', 'WEIGHTED'],
      default: 'BEST_2_OF_3',
    },
    iaWeights: {
      ia1: { type: Number, default: 0.3 },
      ia2: { type: Number, default: 0.3 },
      ia3: { type: Number, default: 0.4 },
    },
    minimumPassingPercentage: {
      type: Number,
      required: [true, 'Minimum passing percentage is required'],
      default: 40,
    },
    grades: {
      type: [gradeTierSchema],
      default: [
        { grade: 'O', minPercentage: 90, maxPercentage: 100, gradePoint: 10, description: 'Outstanding', isPassing: true },
        { grade: 'A+', minPercentage: 80, maxPercentage: 89.99, gradePoint: 9, description: 'Excellent', isPassing: true },
        { grade: 'A', minPercentage: 70, maxPercentage: 79.99, gradePoint: 8, description: 'Very Good', isPassing: true },
        { grade: 'B+', minPercentage: 60, maxPercentage: 69.99, gradePoint: 7, description: 'Good', isPassing: true },
        { grade: 'B', minPercentage: 50, maxPercentage: 59.99, gradePoint: 6, description: 'Above Average', isPassing: true },
        { grade: 'C', minPercentage: 45, maxPercentage: 49.99, gradePoint: 5, description: 'Average', isPassing: true },
        { grade: 'P', minPercentage: 40, maxPercentage: 44.99, gradePoint: 4, description: 'Pass', isPassing: true },
        { grade: 'F', minPercentage: 0, maxPercentage: 39.99, gradePoint: 0, description: 'Fail', isPassing: false },
      ],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

gradingPolicySchema.index({ academicYear: 1, isDefault: 1 });

export const GradingPolicy = model<IGradingPolicy>('GradingPolicy', gradingPolicySchema);
