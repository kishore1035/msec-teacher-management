import { z } from 'zod';
import {
  PARENT_RELATIONSHIP_TYPES,
  RELATIONSHIP_VERIFICATION_STATUSES,
} from '../models/parent.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid MongoDB ObjectId');

export const createParentSchema = z.object({
  body: z.object({
    user: objectIdSchema.optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8).optional(),
    fatherName: z.string().trim().max(150).optional(),
    motherName: z.string().trim().max(150).optional(),
    guardianName: z.string().trim().max(150).optional(),
    relationshipType: z.enum(PARENT_RELATIONSHIP_TYPES).optional().default('guardian'),
    primaryPhone: z.string().trim().min(7, 'Primary phone number is required').max(25),
    alternatePhone: z.string().trim().max(25).optional(),
    occupation: z.string().trim().max(150).optional(),
    address: z.string().trim().max(500).optional(),
    verificationStatus: z.enum(RELATIONSHIP_VERIFICATION_STATUSES).optional().default('verified'),
    students: z.array(objectIdSchema).optional().default([]),
  }),
});

export const updateParentSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    fatherName: z.string().trim().max(150).optional(),
    motherName: z.string().trim().max(150).optional(),
    guardianName: z.string().trim().max(150).optional(),
    relationshipType: z.enum(PARENT_RELATIONSHIP_TYPES).optional(),
    primaryPhone: z.string().trim().min(7).max(25).optional(),
    alternatePhone: z.string().trim().max(25).optional(),
    email: z.string().trim().email().optional(),
    occupation: z.string().trim().max(150).optional(),
    address: z.string().trim().max(500).optional(),
    verificationStatus: z.enum(RELATIONSHIP_VERIFICATION_STATUSES).optional(),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const linkChildSchema = z.object({
  params: z.object({
    parentId: objectIdSchema,
  }),
  body: z.object({
    studentId: objectIdSchema,
    relationshipType: z.enum(PARENT_RELATIONSHIP_TYPES).optional().default('guardian'),
    isPrimaryGuardian: z.boolean().optional().default(false),
    verificationStatus: z.enum(RELATIONSHIP_VERIFICATION_STATUSES).optional().default('verified'),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const unlinkChildParamSchema = z.object({
  params: z.object({
    parentId: objectIdSchema,
    studentId: objectIdSchema,
  }),
});

export const parentQuerySchema = z.object({
  query: z.object({
    studentId: objectIdSchema.optional(),
    relationshipType: z.enum(PARENT_RELATIONSHIP_TYPES).optional(),
    verificationStatus: z.enum(RELATIONSHIP_VERIFICATION_STATUSES).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const parentChildParamSchema = z.object({
  params: z.object({
    studentId: objectIdSchema,
  }),
});
