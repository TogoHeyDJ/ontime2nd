/**
 * 2D図面→3D変換ツール - Main Application
 */

import { FileUploader } from './components/FileUploader.js';
import { ThreeViewer } from './components/ThreeViewer.js';
import { BracketGenerator } from './components/BracketGenerator.js';
import { StepExporter } from './components/StepExporter.js';
import { DimensionExtractor } from './components/DimensionExtractor.js';

class App {
  constructor() {
    this.fileUploader = null;
    this.threeViewer = null;
    this.bracketGenerator = null;
    this.stepExporter = null;
    this.dimensionExtractor = null;

    this.currentFile = null;
    this.currentMesh = null;
    this.extractedDimensions = [];
    this.dimensionCounter = 0;

    this.init();
  }

  getDefaultDimensions() {
    // Default values based on sample drawing: W273 × H637 × D185
    return {
      width: 273,
      height: 637,
      depth: 185,
      thickness: 3
    };
  }

  async init() {
    console.log('Initializing 2D to 3D Converter...');

    // Initialize components
    this.fileUploader = new FileUploader({
      dropZone: document.getElementById('dropZone'),
      fileInput: document.getElementById('fileInput'),
      preview2d: document.getElementById('preview2d'),
      previewContainer: document.getElementById('preview2dContainer'),
      onFileLoaded: (file, imageData) => this.onFileLoaded(file, imageData)
    });

    this.threeViewer = new ThreeViewer({
      container: document.getElementById('viewer3d'),
      onReady: () => this.onViewerReady()
    });

    this.bracketGenerator = new BracketGenerator();
    this.stepExporter = new StepExporter();
    this.dimensionExtractor = new DimensionExtractor();

    // Bind UI events
    this.bindEvents();

    // Update status
    this.updateStatus('図面をアップロードしてください');
  }

  bindEvents() {
    // Generate button
    document.getElementById('generateBtn').addEventListener('click', () => {
      this.generateModel();
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportStep();
    });

    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', () => {
      this.analyzeDrawing();
    });

    // Add dimension button
    document.getElementById('addDimensionBtn').addEventListener('click', () => {
      this.addDimensionRow();
    });

    // Dimension inputs for 3D model
    const dimensionInputs = ['dimWidth', 'dimHeight', 'dimDepth', 'dimThickness'];
    dimensionInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.onDimensionChange());
      }
    });

    // View buttons
    document.getElementById('viewFront').addEventListener('click', () => {
      this.threeViewer.setView('front');
    });
    document.getElementById('viewTop').addEventListener('click', () => {
      this.threeViewer.setView('top');
    });
    document.getElementById('viewSide').addEventListener('click', () => {
      this.threeViewer.setView('side');
    });
    document.getElementById('viewIso').addEventListener('click', () => {
      this.threeViewer.setView('iso');
    });
    document.getElementById('resetView3d').addEventListener('click', () => {
      this.threeViewer.resetView();
    });

    // 2D zoom controls
    document.getElementById('zoomIn2d').addEventListener('click', () => {
      this.fileUploader.zoom(1.2);
    });
    document.getElementById('zoomOut2d').addEventListener('click', () => {
      this.fileUploader.zoom(0.8);
    });
    document.getElementById('resetView2d').addEventListener('click', () => {
      this.fileUploader.resetZoom();
    });
  }

  onViewerReady() {
    console.log('3D Viewer ready');
    // Generate initial model with default dimensions
    this.generateModel();
  }

  async onFileLoaded(file, imageData) {
    this.currentFile = file;

    // Hide drop zone, show preview
    document.getElementById('dropZone').classList.add('hidden');
    document.getElementById('preview2dContainer').classList.remove('hidden');

    // Enable analyze button
    document.getElementById('analyzeBtn').disabled = false;

    // Hide upload hint, show manual input section
    document.getElementById('uploadHint').classList.add('hidden');
    document.getElementById('manualInputSection').classList.remove('hidden');

    this.updateStatus(`ファイル読み込み完了: ${file.name}`);
    this.showToast('成功', `${file.name} を読み込みました`);

    // Auto-analyze
    await this.analyzeDrawing();
  }

  async analyzeDrawing() {
    if (!this.currentFile) return;

    this.showLoading(true);
    this.updateStatus('OCRエンジンを初期化中...');

    try {
      // Get the image data from the canvas
      const canvas = document.getElementById('preview2d');
      const imageData = canvas.toDataURL('image/png');

      // Extract dimensions with progress callback
      const extractedValues = await this.dimensionExtractor.extract(
        imageData,
        (progress) => {
          this.updateStatus(`図面を解析中... ${progress}%`);
        }
      );

      if (extractedValues && extractedValues.values && extractedValues.values.length > 0) {
        // Clear existing dimensions
        this.extractedDimensions = [];
        this.dimensionCounter = 0;
        document.getElementById('extractedDimensions').innerHTML = '';

        // Add extracted dimensions
        extractedValues.values.forEach((value, index) => {
          this.addDimensionRow(value, `寸法${index + 1}`);
        });

        // Apply to 3D model parameters if we have enough dimensions
        if (extractedValues.width) {
          document.getElementById('dimWidth').value = extractedValues.width;
        }
        if (extractedValues.height) {
          document.getElementById('dimHeight').value = extractedValues.height;
        }
        if (extractedValues.depth) {
          document.getElementById('dimDepth').value = extractedValues.depth;
        }

        // Log raw OCR text for debugging
        console.log('OCR Raw Text:', extractedValues.rawText);
        console.log('Extracted Values:', extractedValues.values);
        console.log('Confidence:', extractedValues.confidence);

        const confidence = Math.round(extractedValues.confidence || 0);
        this.showToast('解析完了', `${extractedValues.values.length}個の寸法を抽出 (信頼度: ${confidence}%)`);
        this.updateStatus(`解析完了 - ${extractedValues.values.length}個の寸法を抽出しました`);
      } else {
        this.showToast('注意', '数値を検出できませんでした。図面の品質を確認してください。');
        this.updateStatus('数値を検出できませんでした');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      this.showToast('エラー', '図面の解析に失敗しました: ' + error.message);
      this.updateStatus('解析エラー');
    } finally {
      this.showLoading(false);
    }
  }

  addDimensionRow(value = '', label = null) {
    this.dimensionCounter++;
    const id = `dim_${this.dimensionCounter}`;
    const labelText = label || `寸法${this.dimensionCounter}`;

    const container = document.getElementById('extractedDimensions');

    const row = document.createElement('div');
    row.className = 'dimension-item';
    row.id = id;
    row.innerHTML = `
      <span class="dimension-label">${labelText}:</span>
      <div class="dimension-input">
        <input type="number" class="form-control form-control-sm" value="${value}" min="0" step="0.1" data-dim-id="${id}">
        <span class="dimension-unit">mm</span>
      </div>
      <button class="btn btn-sm btn-outline-danger btn-remove" data-remove-id="${id}" title="削除">
        <i class="bi bi-x"></i>
      </button>
    `;

    // Add remove event
    row.querySelector('.btn-remove').addEventListener('click', (e) => {
      const removeId = e.currentTarget.dataset.removeId;
      this.removeDimensionRow(removeId);
    });

    container.appendChild(row);

    this.extractedDimensions.push({
      id,
      label: labelText,
      value: parseFloat(value) || 0
    });

    // Hide upload hint if visible
    document.getElementById('uploadHint').classList.add('hidden');
    document.getElementById('manualInputSection').classList.remove('hidden');
  }

  removeDimensionRow(id) {
    const row = document.getElementById(id);
    if (row) {
      row.remove();
      this.extractedDimensions = this.extractedDimensions.filter(d => d.id !== id);
    }
  }

  getDimensionsFromUI() {
    return {
      width: parseFloat(document.getElementById('dimWidth').value) || 273,
      height: parseFloat(document.getElementById('dimHeight').value) || 637,
      depth: parseFloat(document.getElementById('dimDepth').value) || 185,
      thickness: parseFloat(document.getElementById('dimThickness').value) || 3,
      bracketType: 'L', // Default to L-bracket for now
      holes: {
        enabled: false,
        diameter: 6,
        count: 0,
        offsetX: 15,
        offsetY: 15
      },
      bend: {
        angle: 90,
        radius: 2
      }
    };
  }

  onDimensionChange() {
    // Auto-regenerate model when dimensions change (optional)
    // this.generateModel();
  }

  async generateModel() {
    const dimensions = this.getDimensionsFromUI();
    this.showLoading(true);
    this.updateStatus('3Dモデルを生成中...');

    try {
      // Generate bracket geometry
      const geometry = this.bracketGenerator.generate(dimensions);

      // Update 3D viewer
      this.currentMesh = this.threeViewer.setGeometry(geometry);

      // Enable export button
      document.getElementById('exportBtn').disabled = false;

      // Update model info
      const info = this.bracketGenerator.getModelInfo();
      document.getElementById('modelInfo').textContent =
        `頂点: ${info.vertices} | 面: ${info.faces}`;

      this.updateStatus('3Dモデル生成完了');
      this.showToast('成功', '3Dモデルを生成しました');
    } catch (error) {
      console.error('Generation error:', error);
      this.showToast('エラー', 'モデル生成に失敗しました: ' + error.message);
      this.updateStatus('生成エラー');
    } finally {
      this.showLoading(false);
    }
  }

  async exportStep() {
    if (!this.currentMesh) {
      this.showToast('エラー', '先にモデルを生成してください');
      return;
    }

    this.showLoading(true);
    this.updateStatus('STEPファイルを生成中...');

    try {
      const dimensions = this.getDimensionsFromUI();
      const stepData = await this.stepExporter.export(dimensions);

      // Download file
      const blob = new Blob([stepData], { type: 'application/step' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model_${Date.now()}.step`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.updateStatus('STEPファイルをダウンロードしました');
      this.showToast('成功', 'STEPファイルをダウンロードしました');
    } catch (error) {
      console.error('Export error:', error);
      this.showToast('エラー', 'エクスポートに失敗しました: ' + error.message);
      this.updateStatus('エクスポートエラー');
    } finally {
      this.showLoading(false);
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  updateStatus(text) {
    document.getElementById('statusText').innerHTML =
      `<i class="bi bi-info-circle me-1"></i>${text}`;
  }

  showToast(title, message) {
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastBody').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('toast'));
    toast.show();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
