import { Types } from 'mongoose';
import {
  Announcement,
  IAnnouncement,
  AnnouncementType,
  AnnouncementPriority,
  TargetAudience,
  AnnouncementStatus,
} from '../models/announcement.model';
import { Notification } from '../models/notification.model';
import { Student } from '../models/student.model';
import { Parent } from '../models/parent.model';
import { IAttachment } from '../models/assignment.model';
import { AudienceTargetingService } from './audienceTargeting.service';
import { NotificationService } from './notification.service';
import { LocalStorageService, IStorageService } from './storage.service';
import { calculatePagination } from '../utils/pagination';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ROLES } from '../constants/roles.constant';

export interface CreateAnnouncementDTO {
  title: string;
  content: string;
  summary?: string;
  announcementType?: AnnouncementType;
  priority?: AnnouncementPriority;
  targetAudience?: TargetAudience;
  targetRoles?: string[];
  targetDepartments?: string[];
  targetClasses?: string[];
  targetSections?: string[];
  targetSubjects?: string[];
  specificRecipients?: string[];
  publishAt?: string | Date;
  expiresAt?: string | Date;
  status?: AnnouncementStatus;
  isMandatory?: boolean;
  attachments?: IAttachment[];
}

export interface UpdateAnnouncementDTO extends Partial<CreateAnnouncementDTO> {
  changeNote?: string;
}

export class AnnouncementService {
  private static storageService: IStorageService = new LocalStorageService();

  /**
   * Create a new announcement (draft, scheduled, or immediately published)
   */
  public static async createAnnouncement(
    userId: string,
    userRole: string,
    dto: CreateAnnouncementDTO,
    files?: Express.Multer.File[]
  ): Promise<IAnnouncement> {
    const targetAudience: TargetAudience =
      dto.targetAudience || (userRole === ROLES.TEACHER ? 'selected' : 'all');

    const targetingInput = {
      targetAudience,
      targetRoles: dto.targetRoles,
      targetDepartments: dto.targetDepartments,
      targetClasses: dto.targetClasses,
      targetSections: dto.targetSections,
      targetSubjects: dto.targetSubjects,
      specificRecipients: dto.specificRecipients,
    };

    // 1. Validate target references exist
    await AudienceTargetingService.validateTargetReferences(targetingInput);

    // 2. Enforce teacher targeting restrictions
    if (userRole === ROLES.TEACHER) {
      await AudienceTargetingService.validateTeacherAuthorization(userId, targetingInput);
    }

    // 3. Validate publishAt / expiresAt chronological ordering
    const now = new Date();
    const publishAtDate = dto.publishAt ? new Date(dto.publishAt) : undefined;
    const expiresAtDate = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    if (publishAtDate && expiresAtDate && expiresAtDate <= publishAtDate) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'expiresAt must be after publishAt'
      );
    }

    // 4. Process file attachments if uploaded
    const attachments: IAttachment[] = [...(dto.attachments || [])];
    if (files && files.length > 0) {
      for (const file of files) {
        const stored = await this.storageService.saveFile(file, 'announcements');
        attachments.push({
          _id: new Types.ObjectId(),
          filename: stored.filename,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          path: stored.path,
          uploadedAt: stored.uploadedAt,
        });
      }
    }

    // 5. Determine initial status
    let status: AnnouncementStatus = dto.status || 'draft';
    if (publishAtDate && publishAtDate > now && dto.status !== 'draft') {
      status = 'scheduled';
    }

    const userObjId = new Types.ObjectId(userId);
    const isMandatory =
      dto.isMandatory ??
      (dto.announcementType === 'emergency' || dto.priority === 'urgent');

    const announcement = new Announcement({
      title: dto.title,
      content: dto.content,
      summary: dto.summary,
      announcementType: dto.announcementType || 'general',
      priority: dto.priority || 'normal',
      targetAudience,
      targetRoles: dto.targetRoles || [],
      targetDepartments: (dto.targetDepartments || []).map((id) => new Types.ObjectId(id)),
      targetClasses: (dto.targetClasses || []).map((id) => new Types.ObjectId(id)),
      targetSections: (dto.targetSections || []).map((id) => new Types.ObjectId(id)),
      targetSubjects: (dto.targetSubjects || []).map((id) => new Types.ObjectId(id)),
      specificRecipients: (dto.specificRecipients || []).map((id) => new Types.ObjectId(id)),
      attachments,
      publishAt: publishAtDate,
      expiresAt: expiresAtDate,
      status: status === 'published' ? 'draft' : status,
      createdBy: userObjId,
      isMandatory,
      auditLog: [
        {
          action: status === 'scheduled' ? 'scheduled' : 'created',
          performedBy: userObjId,
          timestamp: now,
          details:
            status === 'scheduled'
              ? `Announcement scheduled for ${publishAtDate?.toISOString()}`
              : 'Announcement created',
        },
      ],
    });

    await announcement.save();

    if (status === 'published') {
      return this.publishAnnouncement(userId, userRole, announcement._id.toString());
    }

    return announcement;
  }

  /**
   * Publish an announcement immediately, snapshot its resolved recipients, and generate notifications
   */
  public static async publishAnnouncement(
    userId: string,
    userRole: string,
    announcementId: string
  ): Promise<IAnnouncement> {
    const announcement = await Announcement.findById(announcementId).select(
      '+specificRecipients +resolvedRecipientsSnapshot'
    );

    if (!announcement) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Announcement not found');
    }

    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    if (!isAdmin && announcement.createdBy.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You can only publish announcements that you created'
      );
    }

    if (announcement.status === 'archived') {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Archived announcements cannot be published'
      );
    }

    if (announcement.expiresAt && new Date(announcement.expiresAt) <= new Date()) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cannot publish an announcement whose expiresAt timestamp has already passed'
      );
    }

    const targetingInput = {
      targetAudience: announcement.targetAudience,
      targetRoles: announcement.targetRoles,
      targetDepartments: announcement.targetDepartments,
      targetClasses: announcement.targetClasses,
      targetSections: announcement.targetSections,
      targetSubjects: announcement.targetSubjects,
      specificRecipients: announcement.specificRecipients,
    };

    if (userRole === ROLES.TEACHER) {
      await AudienceTargetingService.validateTeacherAuthorization(userId, targetingInput);
    }

    // Resolve deduplicated audience at publication time and store reproducible snapshot
    const resolvedRecipients = await AudienceTargetingService.resolveRecipients(
      targetingInput,
      announcement.createdBy.toString(),
      userRole
    );

    const now = new Date();
    announcement.status = 'published';
    announcement.publishedAt = announcement.publishedAt || now;
    announcement.updatedBy = new Types.ObjectId(userId);
    announcement.resolvedRecipientsSnapshot = resolvedRecipients;
    announcement.targetRecipientCount = resolvedRecipients.length;
    announcement.auditLog.push({
      action: 'published',
      performedBy: new Types.ObjectId(userId),
      timestamp: now,
      details: `Published to ${resolvedRecipients.length} resolved recipients`,
    });

    await announcement.save();

    // Generate and dispatch notifications to all resolved recipients
    await NotificationService.generateForAnnouncement(announcement, resolvedRecipients);

    return announcement;
  }

  /**
   * Process scheduled announcements that are due for publication (publishAt <= referenceTime).
   * Recalculates recipients at publication time according to the announcement's targeting rules.
   */
  public static async processScheduledAnnouncements(
    referenceTime: Date = new Date()
  ): Promise<{ publishedCount: number; announcementIds: string[] }> {
    const dueAnnouncements = await Announcement.find({
      status: 'scheduled',
      publishAt: { $lte: referenceTime },
    }).select('+specificRecipients +resolvedRecipientsSnapshot');

    const publishedIds: string[] = [];

    for (const ann of dueAnnouncements) {
      if (ann.expiresAt && new Date(ann.expiresAt) <= referenceTime) {
        ann.status = 'archived';
        ann.auditLog.push({
          action: 'expired',
          performedBy: ann.createdBy,
          timestamp: referenceTime,
          details: 'Expired before scheduled publication',
        });
        await ann.save();
        continue;
      }

      const resolvedRecipients = await AudienceTargetingService.resolveRecipients(
        {
          targetAudience: ann.targetAudience,
          targetRoles: ann.targetRoles,
          targetDepartments: ann.targetDepartments,
          targetClasses: ann.targetClasses,
          targetSections: ann.targetSections,
          targetSubjects: ann.targetSubjects,
          specificRecipients: ann.specificRecipients,
        },
        ann.createdBy.toString()
      );

      ann.status = 'published';
      ann.publishedAt = referenceTime;
      ann.resolvedRecipientsSnapshot = resolvedRecipients;
      ann.targetRecipientCount = resolvedRecipients.length;
      ann.auditLog.push({
        action: 'published',
        performedBy: ann.createdBy,
        timestamp: referenceTime,
        details: `Scheduled publication executed for ${resolvedRecipients.length} recipients`,
      });

      await ann.save();
      await NotificationService.generateForAnnouncement(ann, resolvedRecipients);
      publishedIds.push(ann._id.toString());
    }

    return {
      publishedCount: publishedIds.length,
      announcementIds: publishedIds,
    };
  }

  /**
   * Edit/Update an existing announcement while preserving editHistory and audit logs
   */
  public static async updateAnnouncement(
    userId: string,
    userRole: string,
    announcementId: string,
    dto: UpdateAnnouncementDTO,
    files?: Express.Multer.File[]
  ): Promise<IAnnouncement> {
    const announcement = await Announcement.findById(announcementId).select(
      '+specificRecipients +resolvedRecipientsSnapshot'
    );

    if (!announcement) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Announcement not found');
    }

    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    if (!isAdmin && announcement.createdBy.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You can only edit announcements that you created'
      );
    }

    // Preserve pre-update snapshot in editHistory
    announcement.editHistory.push({
      updatedBy: new Types.ObjectId(userId),
      updatedAt: new Date(),
      previousTitle: announcement.title,
      previousContent: announcement.content,
      previousPriority: announcement.priority,
      previousStatus: announcement.status,
      changeNote: dto.changeNote || 'Announcement updated',
    });

    const nextTargetAudience = dto.targetAudience ?? announcement.targetAudience;
    const nextTargeting = {
      targetAudience: nextTargetAudience,
      targetRoles: dto.targetRoles ?? announcement.targetRoles,
      targetDepartments: dto.targetDepartments ?? announcement.targetDepartments,
      targetClasses: dto.targetClasses ?? announcement.targetClasses,
      targetSections: dto.targetSections ?? announcement.targetSections,
      targetSubjects: dto.targetSubjects ?? announcement.targetSubjects,
      specificRecipients: dto.specificRecipients ?? announcement.specificRecipients,
    };

    await AudienceTargetingService.validateTargetReferences(nextTargeting);
    if (userRole === ROLES.TEACHER) {
      await AudienceTargetingService.validateTeacherAuthorization(userId, nextTargeting);
    }

    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.content !== undefined) announcement.content = dto.content;
    if (dto.summary !== undefined) announcement.summary = dto.summary;
    if (dto.announcementType !== undefined)
      announcement.announcementType = dto.announcementType;
    if (dto.priority !== undefined) announcement.priority = dto.priority;
    if (dto.targetAudience !== undefined) announcement.targetAudience = dto.targetAudience;
    if (dto.targetRoles !== undefined) announcement.targetRoles = dto.targetRoles;
    if (dto.targetDepartments !== undefined) {
      announcement.targetDepartments = dto.targetDepartments.map(
        (id) => new Types.ObjectId(id)
      );
    }
    if (dto.targetClasses !== undefined) {
      announcement.targetClasses = dto.targetClasses.map((id) => new Types.ObjectId(id));
    }
    if (dto.targetSections !== undefined) {
      announcement.targetSections = dto.targetSections.map((id) => new Types.ObjectId(id));
    }
    if (dto.targetSubjects !== undefined) {
      announcement.targetSubjects = dto.targetSubjects.map((id) => new Types.ObjectId(id));
    }
    if (dto.specificRecipients !== undefined) {
      announcement.specificRecipients = dto.specificRecipients.map(
        (id) => new Types.ObjectId(id)
      );
    }
    if (dto.publishAt !== undefined) {
      announcement.publishAt = dto.publishAt ? new Date(dto.publishAt) : undefined;
    }
    if (dto.expiresAt !== undefined) {
      announcement.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    }
    if (dto.isMandatory !== undefined) {
      announcement.isMandatory = dto.isMandatory;
    }

    if (files && files.length > 0) {
      for (const file of files) {
        const stored = await this.storageService.saveFile(file, 'announcements');
        announcement.attachments.push({
          _id: new Types.ObjectId(),
          filename: stored.filename,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          path: stored.path,
          uploadedAt: stored.uploadedAt,
        });
      }
    }

    announcement.updatedBy = new Types.ObjectId(userId);
    announcement.auditLog.push({
      action: 'updated',
      performedBy: new Types.ObjectId(userId),
      timestamp: new Date(),
      details: dto.changeNote || 'Announcement fields modified',
    });

    await announcement.save();
    return announcement;
  }

  /**
   * Archive an announcement
   */
  public static async archiveAnnouncement(
    userId: string,
    userRole: string,
    announcementId: string
  ): Promise<IAnnouncement> {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Announcement not found');
    }

    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    if (!isAdmin && announcement.createdBy.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You do not have permission to archive this announcement'
      );
    }

    announcement.status = 'archived';
    announcement.updatedBy = new Types.ObjectId(userId);
    announcement.auditLog.push({
      action: 'archived',
      performedBy: new Types.ObjectId(userId),
      timestamp: new Date(),
      details: 'Announcement archived',
    });

    await announcement.save();
    return announcement;
  }

  /**
   * Delete or archive an announcement (drafts can be deleted; published announcements are archived to preserve history)
   */
  public static async deleteAnnouncement(
    userId: string,
    userRole: string,
    announcementId: string
  ): Promise<{ deleted: boolean; archived: boolean }> {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Announcement not found');
    }

    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    if (!isAdmin && announcement.createdBy.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You do not have permission to delete this announcement'
      );
    }

    if (announcement.status === 'draft') {
      await Announcement.findByIdAndDelete(announcementId);
      return { deleted: true, archived: false };
    }

    // Preserve published/scheduled announcement history by archiving
    announcement.status = 'archived';
    announcement.updatedBy = new Types.ObjectId(userId);
    announcement.auditLog.push({
      action: 'archived',
      performedBy: new Types.ObjectId(userId),
      timestamp: new Date(),
      details: 'Announcement soft-deleted into archive to preserve institutional history',
    });
    await announcement.save();
    return { deleted: false, archived: true };
  }

  /**
   * List announcements visible to the requesting user
   */
  public static async getAnnouncements(
    userId: string,
    userRole: string,
    query: {
      status?: AnnouncementStatus;
      announcementType?: AnnouncementType;
      priority?: AnnouncementPriority;
      search?: string;
      includeExpired?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) {
    // Opportunistically process any scheduled announcements that have reached publishAt
    await this.processScheduledAnnouncements(new Date());

    const now = new Date();
    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    const filter: Record<string, unknown> = {};

    if (query.announcementType) filter.announcementType = query.announcementType;
    if (query.priority) filter.priority = query.priority;

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        { $or: [{ title: regex }, { content: regex }, { summary: regex }] },
      ];
    }

    if (isAdmin) {
      if (query.status) {
        filter.status = query.status;
      }
      if (!query.includeExpired && query.status === 'published') {
        filter.$and = [
          ...(Array.isArray(filter.$and) ? filter.$and : []),
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: now } },
            ],
          },
        ];
      }
    } else if (userRole === ROLES.TEACHER) {
      // Teachers see their own announcements (any status) OR published non-expired announcements where they are in the resolved snapshot
      const userObjId = new Types.ObjectId(userId);
      const visibilityOr: Record<string, unknown>[] = [
        {
          createdBy: userObjId,
          ...(query.status ? { status: query.status } : {}),
        },
      ];

      if (!query.status || query.status === 'published') {
        visibilityOr.push({
          status: 'published',
          resolvedRecipientsSnapshot: userObjId,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        });
      }

      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        { $or: visibilityOr },
      ];
    } else if (userRole === ROLES.STUDENT) {
      // Students NEVER see draft, scheduled, archived, or expired announcements, and only see announcements where they were resolved at publication
      filter.status = 'published';
      filter.resolvedRecipientsSnapshot = new Types.ObjectId(userId);
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
      ];
    } else if (userRole === ROLES.PARENT) {
      // Parents see published non-expired announcements addressed to them OR their linked children
      const parent = await Parent.findOne({ user: userId }).select('_id students').lean();
      const allowedSnapshotUserIds: Types.ObjectId[] = [new Types.ObjectId(userId)];

      if (parent) {
        const linkedStudents = await Student.find({
          $or: [
            { _id: { $in: parent.students || [] } },
            { parent: parent._id },
          ],
        })
          .select('user')
          .lean();

        for (const st of linkedStudents) {
          allowedSnapshotUserIds.push(st.user);
        }
      }

      filter.status = 'published';
      filter.resolvedRecipientsSnapshot = { $in: allowedSnapshotUserIds };
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
      ];
    }

    const total = await Announcement.countDocuments(filter);
    const meta = calculatePagination(query.page, query.limit, total);
    const skip = (meta.page - 1) * meta.limit;

    const items = await Announcement.find(filter)
      .sort({ priority: -1, publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(meta.limit)
      .populate('createdBy', 'email role')
      .populate('targetSections', 'sectionName semester')
      .populate('targetClasses', 'name code')
      .populate('targetSubjects', 'name code')
      .populate('targetDepartments', 'name code');

    return { items, meta };
  }

  /**
   * Get single announcement by ID with strict access & visibility enforcement
   */
  public static async getAnnouncementById(
    userId: string,
    userRole: string,
    announcementId: string
  ): Promise<IAnnouncement> {
    await this.processScheduledAnnouncements(new Date());

    const announcement = await Announcement.findById(announcementId)
      .select('+resolvedRecipientsSnapshot')
      .populate('createdBy', 'email role')
      .populate('targetSections', 'sectionName semester')
      .populate('targetClasses', 'name code')
      .populate('targetSubjects', 'name code')
      .populate('targetDepartments', 'name code');

    if (!announcement) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Announcement not found');
    }

    const isAllowed = await AudienceTargetingService.isUserInAnnouncementAudience(
      announcement,
      userId,
      userRole
    );

    if (!isAllowed) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'You do not have permission to view this announcement'
      );
    }

    return announcement;
  }

  /**
   * Announcement Readership & Delivery Analytics (restricted to Admin/SuperAdmin or announcement creator)
   */
  public static async getAnnouncementAnalytics(
    userId: string,
    userRole: string,
    announcementId: string
  ) {
    const announcement = await Announcement.findById(announcementId).select(
      '+resolvedRecipientsSnapshot'
    );

    if (!announcement) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Announcement not found');
    }

    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    if (!isAdmin && announcement.createdBy.toString() !== userId) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only administrators and the announcement creator can view readership analytics'
      );
    }

    const [totalNotifications, readCount, deliveryStats] = await Promise.all([
      Notification.countDocuments({ announcement: announcement._id }),
      Notification.countDocuments({ announcement: announcement._id, isRead: true }),
      Notification.aggregate([
        { $match: { announcement: announcement._id } },
        {
          $group: {
            _id: '$deliveryStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalTargeted =
      announcement.targetRecipientCount ||
      announcement.resolvedRecipientsSnapshot?.length ||
      totalNotifications;

    const unreadCount = Math.max(0, totalTargeted - readCount);
    const readPercentage =
      totalTargeted > 0
        ? Number(((readCount / totalTargeted) * 100).toFixed(2))
        : 0;

    const deliveryBreakdown: Record<string, number> = {
      delivered: 0,
      partial: 0,
      failed: 0,
      pending: 0,
      sent: 0,
    };

    for (const row of deliveryStats) {
      if (row._id && row._id in deliveryBreakdown) {
        deliveryBreakdown[row._id] = row.count;
      }
    }

    return {
      announcementId: announcement._id,
      title: announcement.title,
      status: announcement.status,
      priority: announcement.priority,
      announcementType: announcement.announcementType,
      publishedAt: announcement.publishedAt,
      totalTargeted,
      totalNotificationsCreated: totalNotifications,
      readCount,
      unreadCount,
      readPercentage,
      deliveryBreakdown,
    };
  }

  /**
   * Institution-wide or Teacher-scoped Announcement Analytics Overview
   */
  public static async getAnalyticsOverview(userId: string, userRole: string) {
    const isAdmin = userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
    if (!isAdmin && userRole !== ROLES.TEACHER) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Only administrators and teachers can access announcement analytics overview'
      );
    }

    const matchStage: Record<string, unknown> = isAdmin
      ? {}
      : { createdBy: new Types.ObjectId(userId) };

    const [statusCounts, typeCounts, publishedAnnouncements] = await Promise.all([
      Announcement.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Announcement.aggregate([
        { $match: matchStage },
        { $group: { _id: '$announcementType', count: { $sum: 1 } } },
      ]),
      Announcement.find({ ...matchStage, status: 'published' })
        .select('_id targetRecipientCount')
        .lean(),
    ]);

    const publishedIds = publishedAnnouncements.map((a) => a._id);
    const totalTargetedSum = publishedAnnouncements.reduce(
      (sum, a) => sum + (a.targetRecipientCount || 0),
      0
    );

    const [totalNotifications, totalRead] =
      publishedIds.length > 0
        ? await Promise.all([
            Notification.countDocuments({ announcement: { $in: publishedIds } }),
            Notification.countDocuments({
              announcement: { $in: publishedIds },
              isRead: true,
            }),
          ])
        : [0, 0];

    const denominator = totalTargetedSum || totalNotifications;
    const overallReadPercentage =
      denominator > 0 ? Number(((totalRead / denominator) * 100).toFixed(2)) : 0;

    const byStatus: Record<string, number> = {
      draft: 0,
      scheduled: 0,
      published: 0,
      archived: 0,
    };
    for (const row of statusCounts) {
      if (row._id && row._id in byStatus) {
        byStatus[row._id] = row.count;
      }
    }

    const byType: Record<string, number> = {};
    for (const row of typeCounts) {
      if (row._id) {
        byType[row._id] = row.count;
      }
    }

    return {
      totalAnnouncements: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      byType,
      totalNotificationsDispatched: totalNotifications,
      totalReadReceipts: totalRead,
      overallReadPercentage,
    };
  }
}
