import { Types } from 'mongoose';
import { StudyMaterial } from '../models/studyMaterial.model';

export interface AnalyticsQueryFilters {
  academicYear?: string;
  semester?: number;
  subject?: string;
  teacher?: string;
}

export class StudyMaterialAnalyticsService {
  /**
   * Helper: Build Match query for analytics
   */
  private buildMatchQuery(filters: AnalyticsQueryFilters): Record<string, any> {
    const match: Record<string, any> = {};
    if (filters.academicYear) match.academicYear = new Types.ObjectId(filters.academicYear);
    if (filters.semester) match.semester = filters.semester;
    if (filters.subject) match.subject = new Types.ObjectId(filters.subject);
    if (filters.teacher) match.teacher = new Types.ObjectId(filters.teacher);
    return match;
  }

  /**
   * Overview Resource Analytics
   */
  public async getOverviewAnalytics(filters: AnalyticsQueryFilters = {}): Promise<any> {
    const match = this.buildMatchQuery(filters);

    const [statusStats, engagementStats, typeStats, recentUploads] = await Promise.all([
      // Status counts
      StudyMaterial.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Total downloads and views
      StudyMaterial.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalDownloads: { $sum: '$downloadCount' },
            totalViews: { $sum: '$viewCount' },
            totalAttachments: { $sum: { $size: '$attachments' } },
          },
        },
      ]),

      // Group by materialType
      StudyMaterial.aggregate([
        { $match: match },
        { $group: { _id: '$materialType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Recent 5 uploads
      StudyMaterial.find(match)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('subject', 'name code')
        .populate('teacher', 'firstName lastName')
        .select('title materialType status downloadCount viewCount createdAt'),
    ]);

    const statusMap = new Map<string, number>();
    for (const s of statusStats) {
      statusMap.set(s._id, s.count);
    }

    const totalMaterials = statusStats.reduce((acc, curr) => acc + curr.count, 0);

    return {
      totalMaterials,
      publishedMaterials: statusMap.get('published') || 0,
      draftMaterials: statusMap.get('draft') || 0,
      archivedMaterials: statusMap.get('archived') || 0,
      totalDownloads: engagementStats[0]?.totalDownloads || 0,
      totalViews: engagementStats[0]?.totalViews || 0,
      totalAttachments: engagementStats[0]?.totalAttachments || 0,
      materialsByType: typeStats.map((t) => ({ type: t._id, count: t.count })),
      recentUploads,
    };
  }

  /**
   * Subject-Wise Resource Analytics
   */
  public async getSubjectAnalytics(filters: AnalyticsQueryFilters = {}): Promise<any[]> {
    const match = this.buildMatchQuery(filters);

    const subjectStats = await StudyMaterial.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subject',
          totalMaterials: { $sum: 1 },
          publishedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] },
          },
          totalDownloads: { $sum: '$downloadCount' },
          totalViews: { $sum: '$viewCount' },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: '_id',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },
      { $unwind: '$subjectInfo' },
      {
        $project: {
          subjectId: '$_id',
          subjectName: '$subjectInfo.name',
          subjectCode: '$subjectInfo.code',
          semester: '$subjectInfo.semester',
          credits: '$subjectInfo.credits',
          totalMaterials: 1,
          publishedCount: 1,
          totalDownloads: 1,
          totalViews: 1,
        },
      },
      { $sort: { totalMaterials: -1 } },
    ]);

    return subjectStats;
  }

  /**
   * Teacher Resource Contribution Analytics
   */
  public async getTeacherAnalytics(filters: AnalyticsQueryFilters = {}): Promise<any[]> {
    const match = this.buildMatchQuery(filters);

    const teacherStats = await StudyMaterial.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$teacher',
          totalMaterials: { $sum: 1 },
          publishedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] },
          },
          totalDownloads: { $sum: '$downloadCount' },
          totalViews: { $sum: '$viewCount' },
        },
      },
      {
        $lookup: {
          from: 'teachers',
          localField: '_id',
          foreignField: '_id',
          as: 'teacherInfo',
        },
      },
      { $unwind: '$teacherInfo' },
      {
        $project: {
          teacherId: '$_id',
          teacherName: {
            $concat: ['$teacherInfo.firstName', ' ', '$teacherInfo.lastName'],
          },
          employeeId: '$teacherInfo.employeeId',
          totalMaterials: 1,
          publishedCount: 1,
          totalDownloads: 1,
          totalViews: 1,
        },
      },
      { $sort: { totalMaterials: -1 } },
    ]);

    return teacherStats;
  }

  /**
   * Top Downloaded & Most Popular Materials
   */
  public async getPopularMaterials(
    filters: AnalyticsQueryFilters = {},
    limit: number = 10
  ): Promise<any[]> {
    const match = this.buildMatchQuery(filters);
    match.status = 'published';

    return StudyMaterial.find(match)
      .sort({ downloadCount: -1, viewCount: -1 })
      .limit(limit)
      .populate('subject', 'name code')
      .populate('teacher', 'firstName lastName')
      .populate('section', 'name sectionName')
      .select('title materialType downloadCount viewCount topic unit createdAt');
  }
}
