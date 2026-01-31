/**
 * YOLO Vision 2.0 - Main Application
 * Brutalist black & white edition
 */

class App {
    constructor() {
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvas');
        this.detector = new Detector();
        this.renderer = new Renderer(this.canvas);

        this.isRunning = false;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.detections = [];
        this.segmentation = null;

        this.elements = {
            statusText: document.getElementById('statusText'),
            statusDot: document.getElementById('statusDot'),
            statusBadge: document.getElementById('statusBadge'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            fpsValue: document.getElementById('fpsValue'),
            objectsValue: document.getElementById('objectsValue'),
            processValue: document.getElementById('processValue'),
            modelStatus: document.getElementById('modelStatus'),
            detectionsList: document.getElementById('detectionsList'),
            startBtn: document.getElementById('startBtn'),
            videoContainer: document.getElementById('videoContainer')
        };

        this.loop = this.loop.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);

        this.init();
    }

    async init() {
        this.updateStatus('LOADING', false);

        try {
            await this.detector.load((msg) => {
                this.elements.loadingText.textContent = msg.toUpperCase();
            });

            this.elements.loadingText.textContent = 'READY';
            this.updateStatus('READY', true);
            this.elements.modelStatus.textContent = 'COCO-SSD + BODYPIX';

            this.setupEventListeners();

        } catch (error) {
            this.updateStatus('ERROR', false);
            this.elements.loadingText.textContent = 'LOAD FAILED';
            console.error('Init error:', error);
        }
    }

    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.toggleCamera());

        document.addEventListener('keydown', this.handleKeyPress);

        // Mode buttons
        document.querySelectorAll('[data-detect-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.detectMode;
                this.setDetectMode(mode);
                document.querySelectorAll('[data-detect-mode]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        document.querySelectorAll('[data-viz-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.vizMode;
                this.renderer.updateSettings({ vizMode: mode });
                document.querySelectorAll('[data-viz-mode]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
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

        document.getElementById('smoothingSlider')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.renderer.updateSettings({ smoothing: value });
            document.getElementById('smoothingValue').textContent = value;
        });

        // Color pickers
        document.getElementById('fillColorPicker')?.addEventListener('input', (e) => {
            this.renderer.updateSettings({ fillColor: e.target.value });
        });

        document.getElementById('outlineColorPicker')?.addEventListener('input', (e) => {
            this.renderer.updateSettings({ outlineColor: e.target.value });
        });

        document.getElementById('bgColorPicker')?.addEventListener('input', (e) => {
            this.renderer.updateSettings({ bgColor: e.target.value });
        });

        // Toggles
        document.getElementById('bgReplaceToggle')?.addEventListener('change', (e) => {
            this.renderer.updateSettings({ bgReplace: e.target.checked });
        });

        document.getElementById('personOnlyToggle')?.addEventListener('change', (e) => {
            this.detector.setPersonOnly(e.target.checked);
        });

        document.getElementById('showLabelsToggle')?.addEventListener('change', (e) => {
            this.renderer.updateSettings({ showLabels: e.target.checked });
        });
    }

    handleKeyPress(e) {
        const key = e.key.toUpperCase();

        if (['E', 'R', 'T', 'Z', 'U', 'I', 'O'].includes(key)) {
            const preset = this.renderer.applyPreset(key);
            if (preset) {
                this.showNotification(key);
                this.updateUI();
            }
        }

        if (e.code === 'Space' && e.target === document.body) {
            e.preventDefault();
            this.toggleCamera();
        }

        if (e.key === 'Escape' && document.fullscreenElement) {
            document.exitFullscreen();
        }

        if (key === 'F' && !e.ctrlKey && !e.metaKey) {
            this.toggleFullscreen();
        }

        if (key === 'M' && !e.ctrlKey && !e.metaKey) {
            const isSegmentation = this.renderer.settings.segmentationMode;
            const newMode = isSegmentation ? 'detection' : 'segmentation';
            this.setDetectMode(newMode);

            document.querySelectorAll('[data-detect-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.detectMode === newMode);
            });

            this.showNotification(newMode.toUpperCase());
        }

        if (key === 'B' && !e.ctrlKey && !e.metaKey) {
            const toggle = document.getElementById('bgReplaceToggle');
            if (toggle) {
                toggle.checked = !toggle.checked;
                this.renderer.updateSettings({ bgReplace: toggle.checked });
                this.showNotification(toggle.checked ? 'BG ON' : 'BG OFF');
            }
        }
    }

    setDetectMode(mode) {
        this.detector.setMode(mode);
        this.renderer.updateSettings({ segmentationMode: mode === 'segmentation' });
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
            this.elements.loadingText.textContent = 'CAMERA';

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            });

            this.video.srcObject = stream;
            await this.video.play();

            this.elements.loadingOverlay.style.display = 'none';
            this.elements.startBtn.textContent = 'STOP';

            this.isRunning = true;
            this.updateStatus('LIVE', true);
            this.elements.statusBadge.textContent = 'LIVE';
            this.elements.statusBadge.classList.add('live');

            // Enable segmentation by default
            this.detector.setMode('segmentation');
            this.renderer.updateSettings({ segmentationMode: true });

            this.loop();

        } catch (error) {
            console.error('Camera error:', error);
            this.updateStatus('CAMERA DENIED', false);
            this.elements.loadingText.textContent = 'CAMERA ACCESS DENIED';
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
        this.elements.loadingText.textContent = 'STOPPED';
        this.elements.startBtn.textContent = 'START';
        this.elements.statusBadge.textContent = 'STOPPED';
        this.elements.statusBadge.classList.remove('live');

        this.updateStatus('STOPPED', false);
    }

    async loop() {
        if (!this.isRunning) return;

        const startTime = performance.now();

        const result = await this.detector.detect(this.video);
        this.detections = result.detections;
        this.segmentation = result.segmentation;

        this.renderer.render(this.video, this.detections, this.segmentation);

        const processTime = performance.now() - startTime;
        this.frameCount++;

        const now = performance.now();
        if (now - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }

        this.updateStats(processTime);
        this.updateDetectionsList();

        requestAnimationFrame(this.loop);
    }

    updateStats(processTime) {
        this.elements.fpsValue.textContent = this.fps;
        this.elements.objectsValue.textContent = this.detections.length;
        this.elements.processValue.textContent = Math.round(processTime);
    }

    updateDetectionsList() {
        const list = this.elements.detectionsList;

        if (this.detections.length === 0) {
            list.innerHTML = '<div style="color: var(--muted); font-size: 10px;">NO OBJECTS</div>';
            return;
        }

        list.innerHTML = this.detections.map(det => {
            const hasSeg = det.class === 'person' && this.segmentation;
            return `
                <div class="detection-item">
                    <div class="detection-color" style="background: ${this.renderer.settings.outlineColor}"></div>
                    <div class="detection-info">
                        <div class="detection-class">${det.class.toUpperCase()}${hasSeg ? ' [SEG]' : ''}</div>
                        <div class="detection-confidence">${Math.round(det.confidence * 100)}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateStatus(text, active) {
        this.elements.statusText.textContent = text;
        this.elements.statusDot.classList.toggle('active', active);
    }

    updateUI() {
        // Update color pickers to match current settings
        const fillPicker = document.getElementById('fillColorPicker');
        const outlinePicker = document.getElementById('outlineColorPicker');
        if (fillPicker) fillPicker.value = this.renderer.settings.fillColor;
        if (outlinePicker) outlinePicker.value = this.renderer.settings.outlineColor;

        // Update viz mode buttons
        document.querySelectorAll('[data-viz-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.vizMode === this.renderer.settings.vizMode);
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
            background: #000;
            color: #fff;
            padding: 12px 24px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 2px;
            border: 1px solid #fff;
            z-index: 10000;
            animation: fadeInOut 1s ease forwards;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 1000);
    }
}

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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
