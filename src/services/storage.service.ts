import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../constants/statusCodes';

export interface StoredFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
}

export interface IStorageService {
  saveFile(file: Express.Multer.File, subfolder?: string): Promise<StoredFile>;
  getFileStream(filePath: string): fs.ReadStream;
  deleteFile(filePath: string): Promise<void>;
  getAbsolutePath(filePath: string): string;
  sanitizeFileName(originalName: string): string;
}

export class LocalStorageService implements IStorageService {
  private readonly uploadRoot: string;

  constructor(uploadRoot?: string) {
    this.uploadRoot = path.resolve(uploadRoot || path.join(process.cwd(), 'uploads'));
    this.ensureDirectoryExists(this.uploadRoot);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  public sanitizeFileName(originalName: string): string {
    // Strip paths, control chars, null bytes, and directory traversal
    const baseName = path.basename(originalName).replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, '');
    return baseName.replace(/\.{2,}/g, '.').trim() || 'file';
  }

  public getAbsolutePath(filePath: string): string {
    const safeRelative = filePath.replace(/^[/\\]+/, '');
    const resolved = path.resolve(this.uploadRoot, safeRelative);

    // Path traversal defense
    if (!resolved.startsWith(this.uploadRoot)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Invalid file path or path traversal detected'
      );
    }

    return resolved;
  }

  public async saveFile(file: Express.Multer.File, subfolder: string = 'assignments'): Promise<StoredFile> {
    const targetFolder = path.join(this.uploadRoot, subfolder);
    this.ensureDirectoryExists(targetFolder);

    const safeOriginalName = this.sanitizeFileName(file.originalname);
    const ext = path.extname(safeOriginalName).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const generatedFilename = `${path.basename(safeOriginalName, ext)}-${uniqueSuffix}${ext}`;

    const destinationPath = path.join(targetFolder, generatedFilename);
    const relativePath = path.relative(this.uploadRoot, destinationPath).replace(/\\/g, '/');

    // If multer already wrote to disk
    if (file.path && fs.existsSync(file.path)) {
      if (file.path !== destinationPath) {
        await fs.promises.rename(file.path, destinationPath);
      }
    } else if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No file content to store');
    }

    return {
      filename: generatedFilename,
      originalName: safeOriginalName,
      mimeType: file.mimetype,
      size: file.size,
      path: relativePath,
      uploadedAt: new Date(),
    };
  }

  public getFileStream(filePath: string): fs.ReadStream {
    const absolutePath = this.getAbsolutePath(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Requested attachment file not found on server');
    }
    return fs.createReadStream(absolutePath);
  }

  public async deleteFile(filePath: string): Promise<void> {
    try {
      const absolutePath = this.getAbsolutePath(filePath);
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      // Fail gracefully on file deletion if already gone
    }
  }
}

export const storageService = new LocalStorageService();
