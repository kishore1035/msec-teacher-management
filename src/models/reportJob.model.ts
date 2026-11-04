import mongoose, { Document, Schema, Types } from 'mongoose';

export type ReportJobType =
  | 'attendance'
  | 'assignments'
  | 'examinations'
  | 'student_progress'
  | 'teacher_workload'
  | 'leave_summary'
  | 'substitution_summary';

export type ReportExportFormat = 'pdf' | 'excel' | 'csv';

export type ReportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'expired';

export interface IReportJobFilters {
  academicYear?: string;
  semester?: number;
  department?: string;
  class?: string;
  section?: string;
  subject?: string;
  student?: string;
  teacher?: string;
  startDate?: string;
  endDate?: string;
}

export interface IReportJob extends Document {
  requestedBy: Types.ObjectId;
  requesterRole: string;
  reportType: ReportJobType;
  title: string;
  filters: IReportJobFilters;
  exportFormat: ReportExportFormat;
  status: ReportJobStatus;
  rowCount: number;
  summaryMetrics?: Record<string, any>;
  fileReference?: {
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
  };
  errorDetails?: string;
  downloadCount: number;
  requestedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reportJobSchema = new Schema<IReportJob>(
  {
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterRole: { type: String, required: true },
    reportType: {
      type: String,
      enum: [
        'attendance',
        'assignments',
        'examinations',
        'student_progress',
        'teacher_workload',
        'leave_summary',
        'substitution_summary',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    filters: {
      academicYear: { type: String },
      semester: { type: Number },
      department: { type: String },
      class: { type: String },
      section: { type: String },
      subject: { type: String },
      student: { type: String },
      teacher: { type: String },
      startDate: { type: String },
      endDate: { type: String },
    },
    exportFormat: {
      type: String,
      enum: ['pdf', 'excel', 'csv'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed', 'expired'],
      default: 'queued',
      index: true,
    },
    rowCount: { type: Number, default: 0 },
    summaryMetrics: { type: Schema.Types.Mixed },
    fileReference: {
      fileName: { type: String },
      originalName: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      path: { type: String },
    },
    errorDetails: { type: String, trim: true },
    downloadCount: { type: Number, default: 0 },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

reportJobSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
reportJobSchema.index({ reportType: 1, createdAt: -1 });

export const ReportJob = mongoose.model<IReportJob>('ReportJob', reportJobSchema);
