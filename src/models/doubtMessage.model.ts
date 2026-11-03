import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export interface IDoubtMessage extends Document {
  _id: Types.ObjectId;
  doubt: Types.ObjectId;
  sender: Types.ObjectId;
  senderRole: string;
  message: string;
  attachments: IAttachment[];
  isInternalNote: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const doubtMessageSchema = new Schema<IDoubtMessage>(
  {
    doubt: {
      type: Schema.Types.ObjectId,
      ref: 'Doubt',
      required: [true, 'Doubt reference is required'],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender user reference is required'],
      index: true,
    },
    senderRole: {
      type: String,
      required: [true, 'Sender role is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true,
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

doubtMessageSchema.index({ doubt: 1, isInternalNote: 1, createdAt: 1 });
doubtMessageSchema.index({ doubt: 1, createdAt: 1 });

export const DoubtMessage = model<IDoubtMessage>('DoubtMessage', doubtMessageSchema);
