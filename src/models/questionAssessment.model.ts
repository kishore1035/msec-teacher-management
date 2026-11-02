import { Schema, model, Document, Types } from 'mongoose';

export type QuestionType = 'mcq' | 'short_answer' | 'long_answer' | 'practical' | 'component';

export interface IQuestion {
  questionNumber: string;
  questionText: string;
  type: QuestionType;
  maxMarks: number;
  negativeMarks?: number;
  options?: string[];
  rubricCriteria?: string;
}

export interface IQuestionSection {
  name: string;
  instructions?: string;
  totalMarks: number;
  questions: IQuestion[];
}

export interface IQuestionAssessment extends Document {
  _id: Types.ObjectId;
  examination: Types.ObjectId;
  subject: Types.ObjectId;
  sections: IQuestionSection[];
  totalAssessmentMarks: number;
  instructions?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    questionNumber: { type: String, required: true },
    questionText: { type: String, required: true },
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer', 'practical', 'component'],
      default: 'short_answer',
    },
    maxMarks: { type: Number, required: true, min: 1 },
    negativeMarks: { type: Number, default: 0, min: 0 },
    options: [{ type: String }],
    rubricCriteria: { type: String },
  },
  { _id: false }
);

const questionSectionSchema = new Schema<IQuestionSection>(
  {
    name: { type: String, required: true },
    instructions: { type: String },
    totalMarks: { type: Number, required: true },
    questions: [questionSchema],
  },
  { _id: false }
);

const questionAssessmentSchema = new Schema<IQuestionAssessment>(
  {
    examination: {
      type: Schema.Types.ObjectId,
      ref: 'Examination',
      required: true,
      index: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    sections: [questionSectionSchema],
    totalAssessmentMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    instructions: { type: String },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

questionAssessmentSchema.index({ examination: 1, subject: 1 }, { unique: true });

export const QuestionAssessment = model<IQuestionAssessment>(
  'QuestionAssessment',
  questionAssessmentSchema
);
