import { Schema, model, Document, Types } from 'mongoose';
import { IAttachment, attachmentSchema } from './assignment.model';

export interface IParentCommunicationMessage extends Document {
  _id: Types.ObjectId;
  communication: Types.ObjectId;
  sender: Types.ObjectId;
  senderRole: string;
  message: string;
  attachments: IAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const parentCommunicationMessageSchema = new Schema<IParentCommunicationMessage>(
  {
    communication: {
      type: Schema.Types.ObjectId,
      ref: 'ParentCommunication',
      required: [true, 'ParentCommunication reference is required'],
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

parentCommunicationMessageSchema.index({ communication: 1, createdAt: 1 });

export const ParentCommunicationMessage = model<IParentCommunicationMessage>(
  'ParentCommunicationMessage',
  parentCommunicationMessageSchema
);
