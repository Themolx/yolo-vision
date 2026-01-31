/**
 * YOLO Vision 2.0 - Main Application
 * Browser-based object detection + segmentation with TensorFlow.js
 */

class App {
    constructor() {
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvas');
        this.detector = new Detector();
        this.renderer = new Renderer(this.canvas);

        // State
        this.isRunning = false;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.detections = [];
        this.segmentation = null;

        // DOM Elements
        this.elements = {
            status: document.getElementById('status'),
            statusText: document.getElementById('statusText'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            fpsValue: document.getElementById('fpsValue'),
            objectsValue: document.getElementById('objectsValue'),
            processValue: document.getElementById('processValue'),
            modelValue: document.getElementById('modelValue'),
            detectionsList: document.getElementById('detectionsList'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsPanel: document.getElementById('settingsPanel'),
            startBtn: document.getElementById('startBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            videoContainer: document.getElementById('videoContainer')
        };

        // Bind methods
        this.loop = this.loop.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        // Initialize
        this.init();
    }

    async init() {
        this.updateStatus('loading', 'Loading models...');

        try {
            // Load models with progress updates
            await this.detector.load((msg) => {
                this.elements.loadingText.textContent = msg;
            });

            this.elements.loadingText.textContent = 'Click Start to begin';
            this.updateStatus('ready', 'Models ready');
            this.elements.modelValue.textContent = 'COCO + BodyPix';

            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            this.updateStatus('error', 'Failed to load');
            this.elements.loadingText.textContent = 'Error: ' + error.message;
            console.error('Initialization error:', error);
        }
    }

    setupEventListeners() {
        // Start button
        this.elements.startBtn.addEventListener('click', () => this.toggleCamera());

        // Settings toggle
        this.elements.settingsBtn.addEventListener('click', () => {
            this.elements.settingsPanel.classList.toggle('visible');
        });

        // Fullscreen
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyPress);

        // Visualization mode buttons
        document.querySelectorAll('[data-viz-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.vizMode;
                this.setVizMode(mode);
            });
        });

        // Color mode buttons
        document.querySelectorAll('[data-color-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.colorMode;
                this.setColorMode(mode);
            });
        });

        // Detection mode buttons
        document.querySelectorAll('[data-detect-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.detectMode;
                this.setDetectMode(mode);
            });
        });

        // Sliders
        document.getElementById('confidenceSlider')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.detector.setConfidence(value);
            document.getElementById('confidenceValue').textContent = value.toFixed(2);
        });

        document.getElementById('opacitySlider')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.renderer.updateSettings({ fillOpacity: value });
            document.getElementById('opacityValue').textContent = Math.round(value * 100) + '%';
        });

        document.getElementById('thicknessSlider')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.renderer.updateSettings({ outlineThickness: value });
            document.getElementById('thicknessValue').textContent = value + 'px';
        });

        // Color pickers
        document.getElementById('fillColorPicker')?.addEventListener('input', (e) => {
            this.renderer.updateSettings({ fillColor: e.target.value });
        });

        document.getElementById('outlineColorPicker')?.addEventListener('input', (e) => {
            this.renderer.updateSettings({ outlineColor: e.target.value });
        });

        // Toggles
        document.getElementById('personOnlyToggle')?.addEventListener('change', (e) => {
            this.detector.setPersonOnly(e.target.checked);
        });

        document.getElementById('showLabelsToggle')?.addEventListener('change', (e) => {
            this.renderer.updateSettings({ showLabels: e.target.checked });
        });

        document.getElementById('segmentationToggle')?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            this.detector.setMode(enabled ? 'segmentation' : 'detection');
            this.renderer.updateSettings({ segmentationMode: enabled });
        });
    }

    handleKeyPress(e) {
        const key = e.key.toUpperCase();

        // Preset keys
        if (['E', 'R', 'T', 'Z', 'U', 'I', 'O'].includes(key)) {
            const preset = this.renderer.applyPreset(key);
            if (preset) {
                this.showNotification(`Preset: ${key}`);
                this.updateModeButtons();
            }
        }

        // Space to start/stop
        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            this.toggleCamera();
        }

        // Escape to exit fullscreen
        if (e.key === 'Escape') {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }

        // S for settings
        if (key === 'S' && !e.ctrlKey && !e.metaKey) {
            this.elements.settingsPanel.classList.toggle('visible');
        }

        // F for fullscreen
        if (key === 'F' && !e.ctrlKey && !e.metaKey) {
            this.toggleFullscreen();
        }

        // M to toggle segmentation mode
        if (key === 'M' && !e.ctrlKey && !e.metaKey) {
            const toggle = document.getElementById('segmentationToggle');
            if (toggle) {
                toggle.checked = !toggle.checked;
                const enabled = toggle.checked;
                this.detector.setMode(enabled ? 'segmentation' : 'detection');
                this.renderer.updateSettings({ segmentationMode: enabled });
                this.showNotification(enabled ? 'Segmentation ON' : 'Segmentation OFF');
            }
        }
    }

    setDetectMode(mode) {
        this.detector.setMode(mode);
        this.renderer.updateSettings({ segmentationMode: mode === 'segmentation' });

        document.querySelectorAll('[data-detect-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.detectMode === mode);
        });

        const toggle = document.getElementById('segmentationToggle');
        if (toggle) toggle.checked = mode === 'segmentation';
    }

    async toggleCamera() {
        if (this.isRunning) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            this.elements.loadingText.textContent = 'Requesting camera access...';

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = stream;
            await this.video.play();

            // Hide loading overlay
            this.elements.loadingOverlay.style.display = 'none';

            // Update button
            this.elements.startBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Stop
            `;

            this.isRunning = true;
            this.updateStatus('ready', 'Detecting');

            // Enable segmentation by default
            this.detector.setMode('segmentation');
            this.renderer.updateSettings({ segmentationMode: true });
            const toggle = document.getElementById('segmentationToggle');
            if (toggle) toggle.checked = true;

            // Start detection loop
            this.loop();

        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('error', 'Camera denied');
            this.elements.loadingText.textContent = 'Camera access denied. Please allow camera access.';
        }
    }

    stopCamera() {
        this.isRunning = false;

        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }

        this.renderer.clear();
        this.elements.loadingOverlay.style.display = 'flex';
        this.elements.loadingText.textContent = 'Click Start to begin';

        this.elements.startBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Start
        `;

        this.updateStatus('ready', 'Stopped');
    }

    async loop() {
        if (!this.isRunning) return;

        const startTime = performance.now();

        // Detect objects and segment
        const result = await this.detector.detect(this.video);
        this.detections = result.detections;
        this.segmentation = result.segmentation;

        // Render frame with detections and segmentation
        this.renderer.render(this.video, this.detections, this.segmentation);

        // Calculate stats
        const processTime = performance.now() - startTime;
        this.frameCount++;

        // Update FPS every second
        const now = performance.now();
        if (now - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }

        // Update UI
        this.updateStats(processTime);
        this.updateDetectionsList();

        // Next frame
        requestAnimationFrame(this.loop);
    }

    updateStats(processTime) {
        this.elements.fpsValue.textContent = this.fps;
        this.elements.objectsValue.textContent = this.detections.length;
        this.elements.processValue.textContent = Math.round(processTime) + 'ms';
    }

    updateDetectionsList() {
        const list = this.elements.detectionsList;

        if (this.detections.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No objects detected</p>';
            return;
        }

        list.innerHTML = this.detections.map(det => {
            const color = this.renderer.settings.colorMode === 'position'
                ? this.renderer.getPositionColor(det.bbox.x, det.bbox.y, det.bbox.width, det.bbox.height)
                : this.renderer.settings.outlineColor;

            const hasSegmentation = det.class === 'person' && this.segmentation;

            return `
                <div class="detection-item">
                    <div class="detection-color" style="background: ${color}"></div>
                    <div class="detection-info">
                        <div class="detection-class">${det.class} ${hasSegmentation ? '🎭' : ''}</div>
                        <div class="detection-confidence">${Math.round(det.confidence * 100)}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateStatus(type, text) {
        this.elements.status.className = `status-badge ${type}`;
        this.elements.statusText.textContent = text;
    }

    setVizMode(mode) {
        this.renderer.updateSettings({ vizMode: mode });
        this.updateModeButtons();
    }

    setColorMode(mode) {
        this.renderer.updateSettings({ colorMode: mode });
        this.updateModeButtons();
    }

    updateModeButtons() {
        document.querySelectorAll('[data-viz-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.vizMode === this.renderer.settings.vizMode);
        });

        document.querySelectorAll('[data-color-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.colorMode === this.renderer.settings.colorMode);
        });
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            this.elements.videoContainer.classList.remove('fullscreen');
        } else {
            this.elements.videoContainer.requestFullscreen();
            this.elements.videoContainer.classList.add('fullscreen');
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            animation: fadeInOut 1.5s ease forwards;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 1500);
    }
}

// Add notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
