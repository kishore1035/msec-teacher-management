import fs from 'fs';
import { Types } from 'mongoose';
import { StudyMaterial, IStudyMaterial } from '../models/studyMaterial.model';
import { IAttachment } from '../models/assignment.model';
import { Student } from '../models/student.model';
import { Teacher } from '../models/teacher.model';
import { Subject } from '../models/subject.model';
import { LocalStorageService, IStorageService } from './storage.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { calculatePagination } from '../utils/pagination';

export interface SearchMaterialsDTO {
  q: string;
  subject?: string;
  section?: string;
  materialType?: string;
  semester?: number;
  page?: number;
  limit?: number;
}

export class StudyMaterialAccessService {
  private storageService: IStorageService;

  constructor(storageService?: IStorageService) {
    this.storageService = storageService || new LocalStorageService();
  }

  /**
   * Student Resource Dashboard: Retrieve all available published materials for logged-in student
   */
  public async getMyResources(
    studentUserId: string,
    query: {
      subject?: string;
      materialType?: string;
      unit?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ items: IStudyMaterial[]; meta: any }> {
    const student = await Student.findOne({ user: studentUserId });
    if (!student) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
    }

    const filter: Record<string, any> = {
      status: 'published',
      semester: student.semester,
      $or: [
        { section: student.section },
        { visibility: 'subject' },
        { visibility: 'institution' },
      ],
    };

    if (query.subject) filter.subject = new Types.ObjectId(query.subject);
    if (query.materialType) filter.materialType = query.materialType;
    if (query.unit) filter.unit = query.unit;

    const total = await StudyMaterial.countDocuments(filter);
    const pagination = calculatePagination(query.page, query.limit, total);
    const skip = (pagination.page - 1) * pagination.limit;

    const items = await StudyMaterial.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate('subject', 'name code credits')
      .populate('section', 'name sectionName')
      .populate('teacher', 'firstName lastName')
      .populate('academicYear', 'year');

    return { items, meta: pagination };
  }

  /**
   * Search Materials with Full-Text or Regex fallback and role-scoped permissions
   */
  public async searchMaterials(
    userId: string,
    role: string,
    params: SearchMaterialsDTO
  ): Promise<{ items: IStudyMaterial[]; meta: any }> {
    const query: Record<string, any> = {};

    // 1. Full-text or regex search
    const trimmed = params.q.trim();
    query.$or = [
      { title: { $regex: trimmed, $options: 'i' } },
      { description: { $regex: trimmed, $options: 'i' } },
      { topic: { $regex: trimmed, $options: 'i' } },
      { tags: { $in: [new RegExp(trimmed, 'i')] } },
    ];

    // 2. Role-based scoping
    if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
      }

      query.status = 'published';
      query.semester = student.semester;
      query.$and = [
        {
          $or: [
            { section: student.section },
            { visibility: 'subject' },
            { visibility: 'institution' },
          ],
        },
      ];
    } else if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
      // Teachers can see published + their own drafts
      const teacher = await Teacher.findOne({ user: userId });
      if (teacher) {
        query.$and = [
          {
            $or: [
              { teacher: teacher._id },
              { status: 'published' },
            ],
          },
        ];
      }
    }

    if (params.subject) query.subject = new Types.ObjectId(params.subject);
    if (params.section) query.section = new Types.ObjectId(params.section);
    if (params.materialType) query.materialType = params.materialType;
    if (params.semester) query.semester = params.semester;

    const total = await StudyMaterial.countDocuments(query);
    const pagination = calculatePagination(params.page, params.limit, total);
    const skip = (pagination.page - 1) * pagination.limit;

    const items = await StudyMaterial.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate('subject', 'name code credits')
      .populate('section', 'name sectionName')
      .populate('teacher', 'firstName lastName');

    return { items, meta: pagination };
  }

  /**
   * Retrieve Study Materials by Subject
   */
  public async getMaterialsBySubject(
    userId: string,
    role: string,
    subjectId: string,
    query: { page?: number; limit?: number } = {}
  ): Promise<{ items: IStudyMaterial[]; meta: any }> {
    const subject = await Subject.findById(subjectId);
    if (!subject) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');

    const filter: Record<string, any> = { subject: subject._id };

    if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
      filter.status = 'published';
      filter.$or = [
        { section: student.section },
        { visibility: 'subject' },
        { visibility: 'institution' },
      ];
    }

    const total = await StudyMaterial.countDocuments(filter);
    const pagination = calculatePagination(query.page, query.limit, total);
    const skip = (pagination.page - 1) * pagination.limit;

    const items = await StudyMaterial.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate('teacher', 'firstName lastName')
      .populate('section', 'name sectionName');

    return { items, meta: pagination };
  }

  /**
   * Download Material Attachment with Access Control & Metric Tracking
   */
  public async downloadAttachment(
    userId: string,
    role: string,
    attachmentId: string
  ): Promise<{ stream: fs.ReadStream; attachment: IAttachment; filename: string; mimeType: string }> {
    const material = await StudyMaterial.findOne({
      'attachments._id': new Types.ObjectId(attachmentId),
    });

    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Attachment or study material not found');
    }

    const attachment = material.attachments.find(
      (a) => a._id?.toString() === attachmentId
    );

    if (!attachment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Attachment not found');
    }

    // Role verification
    if (role === ROLES.STUDENT) {
      if (material.status !== 'published') {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Cannot download attachments from unpublished draft study materials'
        );
      }

      const student = await Student.findOne({ user: userId });
      if (!student) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
      }

      const isClassMatch =
        material.section && material.section.toString() === student.section.toString();
      const isSubjectMatch = material.visibility === 'subject';
      const isInstMatch = material.visibility === 'institution';

      if (!isClassMatch && !isSubjectMatch && !isInstMatch) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'Unauthorized to download attachments from this study material'
        );
      }
    } else if (role === ROLES.PARENT) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Parents do not have permission to download teacher study materials directly'
      );
    } else if (role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (!teacher) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Teacher profile not found');
      }
      if (
        material.status === 'draft' &&
        material.teacher.toString() !== teacher._id.toString()
      ) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You cannot download drafts created by other teachers'
        );
      }
    }

    // Atomically increment download count
    await StudyMaterial.findByIdAndUpdate(material._id, { $inc: { downloadCount: 1 } });

    // Stream file securely
    const stream = this.storageService.getFileStream(attachment.path);
    return {
      stream,
      attachment,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
    };
  }

  /**
   * Add attachment to existing study material
   */
  public async addAttachment(
    userId: string,
    role: string,
    materialId: string,
    file: Express.Multer.File
  ): Promise<IAttachment> {
    const material = await StudyMaterial.findById(materialId);
    if (!material) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study material not found');

    if (role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (!teacher || material.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only add attachments to your own materials');
      }
    } else if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    const stored = await this.storageService.saveFile(file, 'materials');
    const newAttachment: IAttachment = {
      _id: new Types.ObjectId(),
      filename: stored.filename,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      size: stored.size,
      path: stored.path,
      uploadedAt: stored.uploadedAt,
    };

    material.attachments.push(newAttachment);
    await material.save();
    return newAttachment;
  }

  /**
   * Delete specific attachment from study material
   */
  public async deleteAttachment(
    userId: string,
    role: string,
    attachmentId: string
  ): Promise<void> {
    const material = await StudyMaterial.findOne({
      'attachments._id': new Types.ObjectId(attachmentId),
    });

    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Attachment or study material not found');
    }

    if (role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (!teacher || material.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only delete attachments from your own materials');
      }
    } else if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    const attachmentIndex = material.attachments.findIndex(
      (a) => a._id?.toString() === attachmentId
    );

    if (attachmentIndex === -1) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Attachment not found in material');
    }

    const [removedAttachment] = material.attachments.splice(attachmentIndex, 1);
    await material.save();

    if (removedAttachment) {
      try {
        await this.storageService.deleteFile(removedAttachment.path);
      } catch {
        // file cleanup error ignored
      }
    }
  }
}
