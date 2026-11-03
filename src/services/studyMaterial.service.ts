import { Types } from 'mongoose';
import {
  StudyMaterial,
  IStudyMaterial,
  MaterialType,
  MaterialVisibility,
  MaterialStatus,
} from '../models/studyMaterial.model';
import { StudyMaterialVersion, IStudyMaterialVersion } from '../models/studyMaterialVersion.model';
import { IAttachment } from '../models/assignment.model';
import { Teacher } from '../models/teacher.model';
import { TeacherAssignment } from '../models/teacherAssignment.model';
import { Subject } from '../models/subject.model';
import { Section } from '../models/section.model';
import { Student } from '../models/student.model';
import { LocalStorageService, IStorageService } from './storage.service';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';
import { calculatePagination } from '../utils/pagination';

export interface CreateStudyMaterialDTO {
  title: string;
  description: string;
  materialType: MaterialType;
  subject: string;
  section?: string;
  academicYear: string;
  semester: number;
  topic?: string;
  unit?: string;
  tags?: string[];
  visibility?: MaterialVisibility;
  status?: MaterialStatus;
}

export interface UpdateStudyMaterialDTO {
  title?: string;
  description?: string;
  materialType?: MaterialType;
  topic?: string;
  unit?: string;
  tags?: string[];
  visibility?: MaterialVisibility;
  status?: MaterialStatus;
  changeDescription?: string;
}

export interface MaterialQueryFilters {
  subject?: string;
  section?: string;
  academicYear?: string;
  semester?: number;
  teacher?: string;
  materialType?: MaterialType;
  visibility?: MaterialVisibility;
  status?: MaterialStatus;
  unit?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export class StudyMaterialService {
  private storageService: IStorageService;

  constructor(storageService?: IStorageService) {
    this.storageService = storageService || new LocalStorageService();
  }

  /**
   * Helper: Resolve Teacher profile
   */
  private async getTeacherForUser(userId: string) {
    const teacher = await Teacher.findOne({ user: userId });
    if (!teacher || teacher.status !== 'Active') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Active Teacher profile required for this operation'
      );
    }
    return teacher;
  }

  /**
   * Helper: Verify Teacher Assignment Authorization
   */
  public async verifyTeacherAuthorization(
    teacherId: Types.ObjectId,
    subjectId: string,
    sectionId?: string
  ): Promise<void> {
    const query: Record<string, any> = {
      teacher: teacherId,
      subject: new Types.ObjectId(subjectId),
      status: 'Active',
    };

    if (sectionId) {
      query.section = new Types.ObjectId(sectionId);
    }

    const assignment = await TeacherAssignment.findOne(query);
    if (!assignment) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You are not actively assigned to teach this subject in the specified section'
      );
    }
  }

  /**
   * Create a new Study Material with attachments
   */
  public async createStudyMaterial(
    userId: string,
    role: string,
    data: CreateStudyMaterialDTO,
    files: Express.Multer.File[] = []
  ): Promise<IStudyMaterial> {
    // 1. Subject validation
    const subject = await Subject.findById(data.subject);
    if (!subject) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Subject not found');
    }

    if (subject.semester !== data.semester) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Subject semester (${subject.semester}) does not match material semester (${data.semester})`
      );
    }

    // 2. Section validation
    let sectionDoc = null;
    if (data.section) {
      sectionDoc = await Section.findById(data.section);
      if (!sectionDoc) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Section not found');
      }
      if (sectionDoc.semester !== data.semester) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          `Section semester (${sectionDoc.semester}) does not match material semester (${data.semester})`
        );
      }
    }

    // 3. Teacher resolution and assignment check
    let teacherId: Types.ObjectId;
    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      teacherId = teacher._id;
      await this.verifyTeacherAuthorization(teacherId, data.subject, data.section);
    } else if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
      const anyTeacher = await Teacher.findOne({ status: 'Active' });
      if (!anyTeacher) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No active teacher found to assign as author');
      }
      teacherId = anyTeacher._id;
    } else {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only teachers and administrators can create study materials');
    }

    // 4. Save file attachments
    const savedAttachments: IAttachment[] = [];
    try {
      for (const file of files) {
        const stored = await this.storageService.saveFile(file, 'materials');
        savedAttachments.push({
          _id: new Types.ObjectId(),
          filename: stored.filename,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          path: stored.path,
          uploadedAt: stored.uploadedAt,
        });
      }

      const isPublished = data.status === 'published';

      const material = await StudyMaterial.create({
        title: data.title,
        description: data.description,
        materialType: data.materialType,
        subject: new Types.ObjectId(data.subject),
        section: data.section ? new Types.ObjectId(data.section) : null,
        academicYear: new Types.ObjectId(data.academicYear),
        semester: data.semester,
        teacher: teacherId,
        topic: data.topic,
        unit: data.unit,
        tags: data.tags || [],
        attachments: savedAttachments,
        visibility: data.visibility || 'class',
        status: data.status || 'draft',
        version: 1,
        downloadCount: 0,
        viewCount: 0,
        publishedAt: isPublished ? new Date() : null,
        createdBy: new Types.ObjectId(userId),
      });

      return material;
    } catch (error) {
      // Clean up orphaned uploaded files
      for (const att of savedAttachments) {
        try {
          await this.storageService.deleteFile(att.path);
        } catch {
          // ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Retrieve list of Study Materials with role-based scoping and filters
   */
  public async getStudyMaterials(
    userId: string,
    role: string,
    filters: MaterialQueryFilters
  ): Promise<{ items: IStudyMaterial[]; meta: any }> {
    const query: Record<string, any> = {};

    // Role-based visibility
    if (role === ROLES.STUDENT) {
      const student = await Student.findOne({ user: userId });
      if (!student) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
      }

      // Students can ONLY see published materials
      query.status = 'published';
      query.semester = student.semester;
      query.$or = [
        { section: student.section },
        { visibility: 'subject' },
        { visibility: 'institution' },
      ];
    } else if (role === ROLES.TEACHER) {
      const teacher = await Teacher.findOne({ user: userId });
      if (teacher) {
        // By default show teacher's materials or materials for teacher's assigned subjects
        if (filters.teacher) {
          query.teacher = new Types.ObjectId(filters.teacher);
        } else {
          query.$or = [
            { teacher: teacher._id },
            { visibility: 'institution', status: 'published' },
          ];
        }
      }
    }

    if (filters.subject) query.subject = new Types.ObjectId(filters.subject);
    if (filters.section) query.section = new Types.ObjectId(filters.section);
    if (filters.academicYear) query.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) query.semester = filters.semester;
    if (filters.materialType) query.materialType = filters.materialType;
    if (filters.visibility) query.visibility = filters.visibility;
    if (filters.status && role !== ROLES.STUDENT) query.status = filters.status;
    if (filters.unit) query.unit = filters.unit;
    if (filters.tag) query.tags = filters.tag;

    const total = await StudyMaterial.countDocuments(query);
    const pagination = calculatePagination(filters.page, filters.limit, total);
    const skip = (pagination.page - 1) * pagination.limit;

    const items = await StudyMaterial.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .populate('subject', 'name code credits')
      .populate('section', 'name sectionName')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('academicYear', 'year');

    return { items, meta: pagination };
  }

  /**
   * Retrieve single Study Material by ID
   */
  public async getStudyMaterialById(
    userId: string,
    role: string,
    materialId: string
  ): Promise<IStudyMaterial> {
    const material = await StudyMaterial.findById(materialId)
      .populate('subject', 'name code credits')
      .populate('section', 'name sectionName')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('academicYear', 'year');

    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study material not found');
    }

    // Role verification
    if (role === ROLES.STUDENT) {
      if (material.status !== 'published') {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Draft materials are not accessible to students');
      }

      const student = await Student.findOne({ user: userId });
      if (!student) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Student profile not found');
      }

      const isClassMatch =
        material.section && material.section._id.toString() === student.section.toString();
      const isSubjectMatch = material.visibility === 'subject';
      const isInstMatch = material.visibility === 'institution';

      if (!isClassMatch && !isSubjectMatch && !isInstMatch) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You are not authorized to access this study material'
        );
      }
    }

    // Increment viewCount atomically
    await StudyMaterial.findByIdAndUpdate(material._id, { $inc: { viewCount: 1 } });
    material.viewCount += 1;

    return material;
  }

  /**
   * Update Material and Archive Previous Version
   */
  public async updateStudyMaterial(
    userId: string,
    role: string,
    materialId: string,
    updateData: UpdateStudyMaterialDTO,
    newFiles: Express.Multer.File[] = []
  ): Promise<IStudyMaterial> {
    const material = await StudyMaterial.findById(materialId);
    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study material not found');
    }

    // Ownership check
    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (material.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'You can only modify study materials created by you'
        );
      }
    } else if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // 1. Archive current version to StudyMaterialVersion
    await StudyMaterialVersion.create({
      material: material._id,
      versionNumber: material.version,
      title: material.title,
      description: material.description,
      topic: material.topic,
      unit: material.unit,
      tags: material.tags,
      attachments: material.attachments,
      changeDescription: updateData.changeDescription || 'Updated study material content',
      updatedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    });

    // 2. Upload new attachments if provided
    const newAttachments: IAttachment[] = [];
    for (const file of newFiles) {
      const stored = await this.storageService.saveFile(file, 'materials');
      newAttachments.push({
        _id: new Types.ObjectId(),
        filename: stored.filename,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        path: stored.path,
        uploadedAt: stored.uploadedAt,
      });
    }

    // 3. Update material fields
    if (updateData.title) material.title = updateData.title;
    if (updateData.description) material.description = updateData.description;
    if (updateData.materialType) material.materialType = updateData.materialType;
    if (updateData.topic !== undefined) material.topic = updateData.topic;
    if (updateData.unit !== undefined) material.unit = updateData.unit;
    if (updateData.tags) material.tags = updateData.tags;
    if (updateData.visibility) material.visibility = updateData.visibility;
    if (updateData.status) material.status = updateData.status;

    if (newAttachments.length > 0) {
      material.attachments.push(...newAttachments);
    }

    material.version += 1;
    material.updatedBy = new Types.ObjectId(userId);

    await material.save();
    return material;
  }

  /**
   * Publish Study Material
   */
  public async publishStudyMaterial(
    userId: string,
    role: string,
    materialId: string
  ): Promise<IStudyMaterial> {
    const material = await StudyMaterial.findById(materialId);
    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study material not found');
    }

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (material.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only publish your own materials');
      }
    }

    material.status = 'published';
    material.publishedAt = new Date();
    material.updatedBy = new Types.ObjectId(userId);
    await material.save();
    return material;
  }

  /**
   * Archive Study Material
   */
  public async archiveStudyMaterial(
    userId: string,
    role: string,
    materialId: string
  ): Promise<IStudyMaterial> {
    const material = await StudyMaterial.findById(materialId);
    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study material not found');
    }

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (material.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only archive your own materials');
      }
    }

    material.status = 'archived';
    material.updatedBy = new Types.ObjectId(userId);
    await material.save();
    return material;
  }

  /**
   * Delete Study Material and Clean Up Files
   */
  public async deleteStudyMaterial(
    userId: string,
    role: string,
    materialId: string
  ): Promise<void> {
    const material = await StudyMaterial.findById(materialId);
    if (!material) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Study material not found');
    }

    if (role === ROLES.TEACHER) {
      const teacher = await this.getTeacherForUser(userId);
      if (material.teacher.toString() !== teacher._id.toString()) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You can only delete your own materials');
      }
    } else if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Delete all attachment files from disk
    for (const att of material.attachments) {
      try {
        await this.storageService.deleteFile(att.path);
      } catch {
        // file cleanup error ignored
      }
    }

    // Remove version documents
    await StudyMaterialVersion.deleteMany({ material: material._id });
    await StudyMaterial.findByIdAndDelete(material._id);
  }

  /**
   * Retrieve Version History for Study Material
   */
  public async getMaterialVersions(
    userId: string,
    role: string,
    materialId: string
  ): Promise<IStudyMaterialVersion[]> {
    const material = await this.getStudyMaterialById(userId, role, materialId);
    return StudyMaterialVersion.find({ material: material._id })
      .sort({ versionNumber: -1 })
      .populate('updatedBy', 'email role');
  }

  /**
   * Retrieve Specific Version of Study Material
   */
  public async getMaterialVersionById(
    userId: string,
    role: string,
    materialId: string,
    versionId: string
  ): Promise<IStudyMaterialVersion> {
    await this.getStudyMaterialById(userId, role, materialId);

    let versionDoc: IStudyMaterialVersion | null = null;
    if (Types.ObjectId.isValid(versionId)) {
      versionDoc = await StudyMaterialVersion.findById(versionId).populate(
        'updatedBy',
        'email role'
      );
    }

    if (!versionDoc) {
      const num = Number(versionId);
      if (!isNaN(num)) {
        versionDoc = await StudyMaterialVersion.findOne({
          material: new Types.ObjectId(materialId),
          versionNumber: num,
        }).populate('updatedBy', 'email role');
      }
    }

    if (!versionDoc) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Material version not found');
    }

    return versionDoc;
  }
}
