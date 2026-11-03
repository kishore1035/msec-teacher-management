import { User } from '../models/user.model';
import { ROLES } from '../constants/roles.constant';
import { logger } from './logger.config';

export const seedDevelopmentData = async (): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    logger.info('Seeding default accounts for development...');

    await User.create([
      {
        email: 'admin@msec.edu.in',
        password: 'AdminPassword123!',
        role: ROLES.SUPER_ADMIN,
        isActive: true,
      },
      {
        email: 'teacher@msec.edu.in',
        password: 'TeacherPassword123!',
        role: ROLES.TEACHER,
        isActive: true,
      },
      {
        email: 'student@msec.edu.in',
        password: 'StudentPassword123!',
        role: ROLES.STUDENT,
        isActive: true,
      },
    ]);

    logger.info('Default development accounts seeded:');
    logger.info('   Super Admin: admin@msec.edu.in / AdminPassword123!');
    logger.info('   Teacher:     teacher@msec.edu.in / TeacherPassword123!');
    logger.info('   Student:     student@msec.edu.in / StudentPassword123!');
  } catch (error) {
    logger.warn('Seed data skipped or failed:', error);
  }
};
