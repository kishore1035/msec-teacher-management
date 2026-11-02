import fs from 'fs';
import path from 'path';
import { storageService } from '../../src/services/storage.service';

describe('Phase 4 – Storage Service & Upload Validation Tests', () => {
  const testUploadDir = path.join(process.cwd(), 'uploads', 'test');

  beforeAll(() => {
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it('should validate and save file safely with sanitized names', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'attachments',
      originalname: '../../../etc/passwd.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      destination: testUploadDir,
      filename: 'dummy-file.pdf',
      path: path.join(testUploadDir, 'dummy-file.pdf'),
      buffer: Buffer.from('%PDF-1.4 test content'),
      stream: null as any,
    };

    fs.writeFileSync(mockFile.path, mockFile.buffer);

    const saved = await storageService.saveFile(mockFile, 'test');
    expect(saved).toBeDefined();
    expect(saved.filename).not.toContain('..');
    expect(saved.filename).toMatch(/\.pdf$/);
    expect(saved.originalName).toBe('passwd.pdf');
    expect(saved.mimeType).toBe('application/pdf');

    // Clean up
    await storageService.deleteFile(saved.path);
  });

  it('should reject path traversal in getFileStream', () => {
    expect(() => {
      storageService.getFileStream('../../../sensitive-system-file.txt');
    }).toThrow(/Invalid file path or path traversal detected/);
  });
});
