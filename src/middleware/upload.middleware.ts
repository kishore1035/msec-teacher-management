import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';
import { env } from '../config/env.config';

const tempUploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const safeBase = path.basename(file.originalname).replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, '');
    const ext = path.extname(safeBase).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.zip',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.mp4',
  '.webm',
]);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Unsupported file type: ${ext} (${file.mimetype}). Permitted formats are PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, ZIP, MP4, WEBM, and standard images.`
      )
    );
  }

  cb(null, true);
};

const maxConfiguredBytes = Math.max(1, env.MAX_FILE_UPLOAD_SIZE_MB) * 1024 * 1024;

export const uploadAssignmentFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.min(25 * 1024 * 1024, maxConfiguredBytes), // 25 MB max per file
    files: 5, // max 5 files per submission or assignment
  },
});

export const uploadMaterialFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxConfiguredBytes, // 50 MB default max per material attachment
    files: 10,
  },
});

export const uploadAnnouncementFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.min(25 * 1024 * 1024, maxConfiguredBytes), // 25 MB max per announcement attachment
    files: 5,
  },
});
