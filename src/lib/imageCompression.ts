/**
 * Image compression and format conversion utilities
 * Converts images to WebP format for better compression and modern browser support
 */

// Supported image formats that can be converted to WebP
const COMPRESSIBLE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Check if a file is a compressible image format
 */
export const isCompressibleImage = (file: File): boolean => {
  return COMPRESSIBLE_FORMATS.includes(file.type);
};

/**
 * Compress an image file to WebP format
 * @param file - The image file to compress
 * @param quality - Compression quality (0-1), default 0.8 (80%)
 * @returns Promise<File> - The compressed image as a WebP file
 */
export const compressImageToWebP = async (
  file: File,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If file is already WebP, return as is
    if (file.type === 'image/webp') {
      resolve(file);
      return;
    }

    // Create image element to get dimensions
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0);

        // Convert canvas to WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Create a new File object with WebP type
            const originalName = file.name.split('.')[0];
            const webpFile = new File([blob], `${originalName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Process a file for upload:
 * - Compress images to WebP format
 * - Keep other files as is
 * @param file - The file to process
 * @returns Promise<File> - The processed file (possibly compressed)
 */
export const processFileForUpload = async (file: File): Promise<File> => {
  try {
    if (isCompressibleImage(file)) {
      const compressedFile = await compressImageToWebP(file, 0.85); // 85% quality
      return compressedFile;
    }

    // Return non-image files as is
    return file;
  } catch (error) {
    console.warn(`⚠️ Compression failed for ${file.name}, uploading original:`, error);
    return file; // Fall back to original file
  }
};

/**
 * Get supported file formats for upload
 */
export const getSupportedFileFormats = () => [
  'PDF (.pdf)',
  'Documents (.doc, .docx)',
  'Images (.jpg, .jpeg, .png, .webp - auto-converted to WebP)',
  'Text (.txt)',
];

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
