/**
 * FileUploader Component
 * Handles drag & drop and file selection for PDF/PNG files
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';

export class FileUploader {
  constructor(options) {
    this.dropZone = options.dropZone;
    this.fileInput = options.fileInput;
    this.preview = options.preview2d;
    this.previewContainer = options.previewContainer;
    this.onFileLoaded = options.onFileLoaded;

    this.currentZoom = 1;
    this.currentImage = null;
    this.isProcessing = false;

    this.init();
  }

  init() {
    // Drag and drop events
    this.dropZone.addEventListener('dragover', (e) => this.onDragOver(e));
    this.dropZone.addEventListener('dragleave', (e) => this.onDragLeave(e));
    this.dropZone.addEventListener('drop', (e) => this.onDrop(e));

    // Click to select - only trigger if not clicking on the label/button
    this.dropZone.addEventListener('click', (e) => {
      // Prevent double-triggering: if click is on label or button, don't trigger again
      if (e.target.tagName === 'LABEL' ||
          e.target.tagName === 'INPUT' ||
          e.target.closest('label')) {
        return;
      }
      this.fileInput.click();
    });

    // File input change - use a single handler and reset input afterward
    this.fileInput.addEventListener('change', (e) => {
      e.stopPropagation();
      this.onFileSelect(e);
    });

    // Preview pan/zoom with mouse
    this.previewContainer.addEventListener('wheel', (e) => this.onWheel(e));
    this.previewContainer.addEventListener('mousedown', (e) => this.onMouseDown(e));
  }

  onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('dragover');
  }

  onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('dragover');
  }

  onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelect(e) {
    if (this.isProcessing) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }

    // Reset the input so the same file can be selected again
    this.fileInput.value = '';
  }

  async processFile(file) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

    if (!validTypes.includes(file.type)) {
      alert('対応形式: PDF, PNG, JPG');
      this.isProcessing = false;
      return;
    }

    console.log('Processing file:', file.name, file.type);

    try {
      if (file.type === 'application/pdf') {
        await this.processPDF(file);
      } else {
        await this.processImage(file);
      }

      if (this.onFileLoaded) {
        this.onFileLoaded(file, this.preview.toDataURL());
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('ファイルの読み込みに失敗しました: ' + error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async processPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Get first page
    const page = await pdf.getPage(1);

    // Set scale for good quality
    const scale = 2;
    const viewport = page.getViewport({ scale });

    // Setup canvas
    this.preview.width = viewport.width;
    this.preview.height = viewport.height;

    const ctx = this.preview.getContext('2d');

    // Render PDF page
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    // Store as image for later use
    this.currentImage = new Image();
    this.currentImage.src = this.preview.toDataURL();

    this.currentZoom = 1;
  }

  async processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Setup canvas
          this.preview.width = img.width;
          this.preview.height = img.height;

          const ctx = this.preview.getContext('2d');
          ctx.drawImage(img, 0, 0);

          this.currentImage = img;
          this.currentZoom = 1;
          resolve();
        };

        img.onerror = reject;
        img.src = e.target.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  zoom(factor) {
    if (!this.currentImage) return;

    this.currentZoom *= factor;
    this.currentZoom = Math.max(0.1, Math.min(5, this.currentZoom));

    this.redraw();
  }

  resetZoom() {
    this.currentZoom = 1;
    this.redraw();
  }

  redraw() {
    if (!this.currentImage) return;

    const ctx = this.preview.getContext('2d');
    const newWidth = this.currentImage.width * this.currentZoom;
    const newHeight = this.currentImage.height * this.currentZoom;

    this.preview.width = newWidth;
    this.preview.height = newHeight;

    ctx.clearRect(0, 0, newWidth, newHeight);
    ctx.drawImage(this.currentImage, 0, 0, newWidth, newHeight);
  }

  onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom(factor);
  }

  onMouseDown(e) {
    if (e.button !== 0) return; // Only left button

    const startX = e.clientX;
    const startY = e.clientY;
    const scrollLeft = this.previewContainer.scrollLeft;
    const scrollTop = this.previewContainer.scrollTop;

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.previewContainer.scrollLeft = scrollLeft - dx;
      this.previewContainer.scrollTop = scrollTop - dy;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
