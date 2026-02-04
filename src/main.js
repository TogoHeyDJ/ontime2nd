/**
 * Bracket 2D to 3D Converter - Main Application
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
    this.dimensions = this.getDefaultDimensions();

    this.init();
  }

  getDefaultDimensions() {
    // Default values based on sample drawing: W273 × H637 × D185
    return {
      width: 273,
      height: 637,
      depth: 185,
      thickness: 3,
      bracketType: 'L',
      holes: {
        enabled: true,
        diameter: 6,
        count: 2,
        offsetX: 15,
        offsetY: 15
      },
      bend: {
        angle: 90,
        radius: 2
      }
    };
  }

  async init() {
    console.log('Initializing Bracket 2D to 3D Converter...');

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

    // Dimension inputs
    const dimensionInputs = [
      'dimWidth', 'dimHeight', 'dimDepth', 'dimThickness',
      'holeDiameter', 'holeCount', 'holeOffsetX', 'holeOffsetY',
      'bendAngle', 'bendRadius'
    ];

    dimensionInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.onDimensionChange());
      }
    });

    // Bracket type
    document.getElementById('bracketType').addEventListener('change', () => {
      this.onDimensionChange();
    });

    // Holes toggle
    document.getElementById('enableHoles').addEventListener('change', (e) => {
      document.getElementById('holeParams').style.display = e.target.checked ? 'block' : 'none';
      this.onDimensionChange();
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

    this.updateStatus(`ファイル読み込み完了: ${file.name}`);
    this.showToast('成功', `${file.name} を読み込みました`);

    // Auto-analyze if image
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      await this.analyzeDrawing();
    }
  }

  async analyzeDrawing() {
    if (!this.currentFile) return;

    this.showLoading(true);
    this.updateStatus('図面を解析中...');

    try {
      // Get the image data from the canvas
      const canvas = document.getElementById('preview2d');
      const imageData = canvas.toDataURL('image/png');

      // Extract dimensions (simulated - in production, use Vision AI)
      const extractedDimensions = await this.dimensionExtractor.extract(imageData);

      if (extractedDimensions) {
        this.applyExtractedDimensions(extractedDimensions);
        this.showToast('解析完了', '寸法を抽出しました。必要に応じて調整してください。');
      }

      this.updateStatus('解析完了 - 寸法を確認してください');
    } catch (error) {
      console.error('Analysis error:', error);
      this.showToast('エラー', '図面の解析に失敗しました: ' + error.message);
      this.updateStatus('解析エラー');
    } finally {
      this.showLoading(false);
    }
  }

  applyExtractedDimensions(dims) {
    if (dims.width) document.getElementById('dimWidth').value = dims.width;
    if (dims.height) document.getElementById('dimHeight').value = dims.height;
    if (dims.depth) document.getElementById('dimDepth').value = dims.depth;
    if (dims.thickness) document.getElementById('dimThickness').value = dims.thickness;
    if (dims.bracketType) document.getElementById('bracketType').value = dims.bracketType;
    if (dims.holeDiameter) document.getElementById('holeDiameter').value = dims.holeDiameter;
    if (dims.bendAngle) document.getElementById('bendAngle').value = dims.bendAngle;
    if (dims.bendRadius) document.getElementById('bendRadius').value = dims.bendRadius;

    this.onDimensionChange();
  }

  onDimensionChange() {
    this.dimensions = {
      width: parseFloat(document.getElementById('dimWidth').value) || 100,
      height: parseFloat(document.getElementById('dimHeight').value) || 80,
      depth: parseFloat(document.getElementById('dimDepth').value) || 50,
      thickness: parseFloat(document.getElementById('dimThickness').value) || 3,
      bracketType: document.getElementById('bracketType').value || 'L',
      holes: {
        enabled: document.getElementById('enableHoles').checked,
        diameter: parseFloat(document.getElementById('holeDiameter').value) || 6,
        count: parseInt(document.getElementById('holeCount').value) || 2,
        offsetX: parseFloat(document.getElementById('holeOffsetX').value) || 15,
        offsetY: parseFloat(document.getElementById('holeOffsetY').value) || 15
      },
      bend: {
        angle: parseFloat(document.getElementById('bendAngle').value) || 90,
        radius: parseFloat(document.getElementById('bendRadius').value) || 2
      }
    };
  }

  async generateModel() {
    this.onDimensionChange();
    this.showLoading(true);
    this.updateStatus('3Dモデルを生成中...');

    try {
      // Generate bracket geometry
      const geometry = this.bracketGenerator.generate(this.dimensions);

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
      const stepData = await this.stepExporter.export(this.dimensions);

      // Download file
      const blob = new Blob([stepData], { type: 'application/step' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bracket_${Date.now()}.step`;
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
