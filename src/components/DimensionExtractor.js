/**
 * DimensionExtractor Component
 * Extracts dimensions from 2D drawings using Tesseract.js OCR
 */

import Tesseract from 'tesseract.js';

export class DimensionExtractor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.isProcessing = false;
  }

  /**
   * Extract dimensions from image data using OCR
   * @param {string} imageDataUrl - Base64 encoded image
   * @param {function} onProgress - Progress callback
   * @returns {Promise<Object>} Extracted dimensions with values array
   */
  async extract(imageDataUrl, onProgress = null) {
    if (this.isProcessing) {
      return null;
    }

    this.isProcessing = true;

    try {
      // Load image
      const img = await this.loadImage(imageDataUrl);

      // Preprocess image for better OCR
      const processedImageUrl = this.preprocessImage(img);

      // Run OCR with Tesseract.js
      const ocrResult = await this.runOCR(processedImageUrl, onProgress);

      // Extract numeric values from OCR result
      const extractedValues = this.extractNumericValues(ocrResult.data.text);

      // Sort and determine primary dimensions
      const sortedBySize = [...extractedValues].sort((a, b) => b - a);

      return {
        values: extractedValues,
        rawText: ocrResult.data.text,
        width: sortedBySize[0] || null,
        height: sortedBySize[1] || null,
        depth: sortedBySize[2] || null,
        confidence: ocrResult.data.confidence
      };
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Load image from data URL
   */
  loadImage(imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  }

  /**
   * Preprocess image for better OCR accuracy
   * - Convert to grayscale
   * - Increase contrast
   * - Apply threshold for cleaner text
   */
  preprocessImage(img) {
    this.canvas.width = img.width;
    this.canvas.height = img.height;

    // Draw original image
    this.ctx.drawImage(img, 0, 0);

    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      // Increase contrast
      let contrast = ((gray - 128) * 1.5) + 128;
      contrast = Math.max(0, Math.min(255, contrast));

      // Apply threshold for cleaner text (binarization)
      const threshold = 180;
      const value = contrast > threshold ? 255 : 0;

      data[i] = value;     // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      // Alpha stays the same
    }

    // Put processed image back
    this.ctx.putImageData(imageData, 0, 0);

    return this.canvas.toDataURL('image/png');
  }

  /**
   * Run OCR using Tesseract.js
   */
  async runOCR(imageUrl, onProgress) {
    const result = await Tesseract.recognize(
      imageUrl,
      'eng+jpn', // English + Japanese for mixed content
      {
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            onProgress(Math.round(m.progress * 100));
          }
        }
      }
    );

    return result;
  }

  /**
   * Extract numeric values from OCR text
   * Looks for patterns like: 123, 123.5, 123mm, 123 mm, φ6, R5, etc.
   */
  extractNumericValues(text) {
    if (!text) return [];

    // Various patterns for dimension values
    const patterns = [
      /(\d+\.?\d*)\s*mm/gi,        // 123mm, 123.5 mm
      /(\d+\.?\d*)\s*㎜/gi,        // Japanese mm
      /φ\s*(\d+\.?\d*)/gi,         // φ6 (diameter)
      /Φ\s*(\d+\.?\d*)/gi,         // Φ6 (diameter)
      /R\s*(\d+\.?\d*)/gi,         // R5 (radius)
      /(\d+)\s*[×x]\s*(\d+)/gi,    // 100×200 (dimensions)
      /(?<![.\d])(\d{2,4})(?![.\d])/g, // Standalone 2-4 digit numbers
    ];

    const values = new Set();

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        // Extract all captured groups
        for (let i = 1; i < match.length; i++) {
          if (match[i]) {
            const num = parseFloat(match[i]);
            // Filter reasonable dimension values (1mm to 9999mm)
            if (num >= 1 && num <= 9999 && !isNaN(num)) {
              values.add(num);
            }
          }
        }
      }
    }

    // Convert to array and sort descending
    return Array.from(values).sort((a, b) => b - a);
  }

  /**
   * Get processing status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing
    };
  }
}
