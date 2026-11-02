import { PaginationMeta } from '../types/common.types';

export const calculatePagination = (page = 1, limit = 20, total = 0): PaginationMeta => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const totalPages = Math.ceil(total / safeLimit) || 1;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
};
