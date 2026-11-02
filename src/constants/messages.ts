export const MESSAGES = {
  // Auth
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
  TOKEN_REFRESH_SUCCESS: 'Access token refreshed successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  INVALID_CREDENTIALS: 'Email or password is incorrect',
  ACCOUNT_INACTIVE: 'Account is deactivated. Please contact an administrator.',
  UNAUTHORIZED: 'Authentication token is missing or invalid',
  FORBIDDEN: 'You do not have permission to perform this action',
  TOKEN_EXPIRED: 'Access token has expired',
  REFRESH_TOKEN_INVALID: 'Refresh token is invalid or has expired',
  REFRESH_TOKEN_REUSED: 'Security violation: Refresh token reuse detected. All sessions revoked.',

  // Academic & Resources
  RESOURCE_CREATED: 'Resource created successfully',
  RESOURCE_FETCHED: 'Resource fetched successfully',
  RESOURCE_UPDATED: 'Resource updated successfully',
  RESOURCE_DELETED: 'Resource deleted successfully',
  RESOURCE_NOT_FOUND: 'Resource not found',
  DUPLICATE_RESOURCE: 'Resource already exists with the given unique identifier',
  CURRENT_ACADEMIC_YEAR_SET: 'Academic year marked as active',
  INVALID_ASSIGNMENT: 'Invalid teacher, subject, or section reference for assignment',

  // System
  INTERNAL_ERROR: 'An internal server error occurred',
  VALIDATION_ERROR: 'Validation error in request parameters',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
} as const;
