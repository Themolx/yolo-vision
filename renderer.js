/**
 * YOLO Vision 2.0 - Renderer Module
 * Canvas-based rendering with segmentation masks and customizable visualization
 */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Offscreen canvas for segmentation compositing
        this.offCanvas = document.createElement('canvas');
        this.offCtx = this.offCanvas.getContext('2d');

        // Visualization settings
        this.settings = {
            vizMode: 'both',        // 'fill', 'outline', 'both'
            colorMode: 'fixed',     // 'fixed', 'position'
            fillColor: '#3b82f6',
            outlineColor: '#2563eb',
            fillOpacity: 0.5,
            outlineThickness: 3,
            showLabels: true,
            showBox: true,
            boxScale: 1.0,
            segmentationMode: true   // Use BodyPix segmentation
        };

        // Preset configurations
        this.presets = {
            'E': {  // Neon
                vizMode: 'both',
                fillColor: '#00ff00',
                outlineColor: '#39ff14',
                fillOpacity: 0.4,
                outlineThickness: 4
            },
            'R': {  // Red Alert
                vizMode: 'outline',
                fillColor: '#ff0000',
                outlineColor: '#ff0000',
                fillOpacity: 0.3,
                outlineThickness: 5
            },
            'T': {  // Matrix
                vizMode: 'both',
                fillColor: '#00ff00',
                outlineColor: '#00aa00',
                fillOpacity: 0.6,
                outlineThickness: 2
            },
            'Z': {  // Cyberpunk
                vizMode: 'both',
                fillColor: '#ff00ff',
                outlineColor: '#00ffff',
                fillOpacity: 0.5,
                outlineThickness: 3
            },
            'U': {  // Clean White
                vizMode: 'outline',
                fillColor: '#ffffff',
                outlineColor: '#ffffff',
                fillOpacity: 0.2,
                outlineThickness: 2
            },
            'I': {  // Dark Mode
                vizMode: 'both',
                fillColor: '#000000',
                outlineColor: '#ffffff',
                fillOpacity: 0.8,
                outlineThickness: 2
            },
            'O': {  // Orange
                vizMode: 'both',
                fillColor: '#ffa500',
                outlineColor: '#ff4500',
                fillOpacity: 0.5,
                outlineThickness: 4
            }
        };
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }

    /**
     * Apply a preset
     */
    applyPreset(key) {
        if (this.presets[key]) {
            Object.assign(this.settings, this.presets[key]);
            return this.presets[key];
        }
        return null;
    }

    /**
     * Get color based on position
     */
    getPositionColor(x, y, width, height) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const hue = (centerX / this.canvas.width) * 360;
        const saturation = 70 + (centerY / this.canvas.height) * 30;
        return `hsl(${hue}, ${saturation}%, 50%)`;
    }

    /**
     * Convert hex to RGBA
     */
    hexToRGBA(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Convert hex to RGB array
     */
    hexToRGB(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    /**
     * Draw segmentation mask from BodyPix
     */
    drawSegmentation(segmentation) {
        if (!segmentation || !segmentation.data) return;

        const width = segmentation.width;
        const height = segmentation.height;

        // Create ImageData for the mask
        const maskData = new ImageData(width, height);
        const fillRGB = this.hexToRGB(this.settings.fillColor);
        const outlineRGB = this.hexToRGB(this.settings.outlineColor);
        const alpha = Math.round(this.settings.fillOpacity * 255);

        // Build the mask
        for (let i = 0; i < segmentation.data.length; i++) {
            const isSegmented = segmentation.data[i] === 1;
            const idx = i * 4;

            if (isSegmented) {
                if (this.settings.vizMode === 'fill' || this.settings.vizMode === 'both') {
                    maskData.data[idx] = fillRGB[0];
                    maskData.data[idx + 1] = fillRGB[1];
                    maskData.data[idx + 2] = fillRGB[2];
                    maskData.data[idx + 3] = alpha;
                }
            }
        }

        // Draw outline by finding edges
        if (this.settings.vizMode === 'outline' || this.settings.vizMode === 'both') {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = y * width + x;
                    if (segmentation.data[i] === 1) {
                        // Check if this is an edge pixel
                        let isEdge = false;
                        for (let dy = -1; dy <= 1 && !isEdge; dy++) {
                            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const ni = ny * width + nx;
                                    if (segmentation.data[ni] === 0) {
                                        isEdge = true;
                                    }
                                }
                            }
                        }
                        if (isEdge) {
                            const idx = i * 4;
                            maskData.data[idx] = outlineRGB[0];
                            maskData.data[idx + 1] = outlineRGB[1];
                            maskData.data[idx + 2] = outlineRGB[2];
                            maskData.data[idx + 3] = 255;
                        }
                    }
                }
            }
        }

        // Resize offscreen canvas
        this.offCanvas.width = width;
        this.offCanvas.height = height;
        this.offCtx.putImageData(maskData, 0, 0);

        // Draw scaled to main canvas
        this.ctx.drawImage(this.offCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw a single detection box
     */
    drawDetection(detection) {
        const { bbox, class: className, confidence } = detection;
        let { x, y, width, height } = bbox;

        // Apply box scale
        if (this.settings.boxScale !== 1.0) {
            const scale = this.settings.boxScale;
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            width *= scale;
            height *= scale;
            x = centerX - width / 2;
            y = centerY - height / 2;
        }

        // Determine colors
        let fillColor, outlineColor;
        if (this.settings.colorMode === 'position') {
            fillColor = this.getPositionColor(x, y, width, height);
            outlineColor = fillColor;
        } else {
            fillColor = this.settings.fillColor;
            outlineColor = this.settings.outlineColor;
        }

        // Draw fill (only if not using segmentation or for non-person objects)
        if (!this.settings.segmentationMode || className !== 'person') {
            if (this.settings.vizMode === 'fill' || this.settings.vizMode === 'both') {
                this.ctx.fillStyle = this.hexToRGBA(fillColor, this.settings.fillOpacity);
                this.ctx.fillRect(x, y, width, height);
            }

            if (this.settings.vizMode === 'outline' || this.settings.vizMode === 'both') {
                this.ctx.strokeStyle = outlineColor;
                this.ctx.lineWidth = this.settings.outlineThickness;
                this.ctx.strokeRect(x, y, width, height);
            }
        }

        // Draw label
        if (this.settings.showLabels) {
            const label = `${className} ${Math.round(confidence * 100)}%`;
            this.ctx.font = '14px Inter, sans-serif';
            const textMetrics = this.ctx.measureText(label);
            const textHeight = 20;
            const padding = 6;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(x, y - textHeight - padding, textMetrics.width + padding * 2, textHeight + padding);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(label, x + padding, y - padding);
        }
    }

    /**
     * Render frame with detections and segmentation
     */
    render(video, detections, segmentation = null) {
        // Set canvas size to match video
        if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
            this.canvas.width = video.videoWidth;
            this.canvas.height = video.videoHeight;
        }

        // Draw video frame
        this.ctx.drawImage(video, 0, 0);

        // Draw segmentation mask if available
        if (segmentation && this.settings.segmentationMode) {
            this.drawSegmentation(segmentation);
        }

        // Draw bounding boxes for non-person objects (or all if no segmentation)
        for (const detection of detections) {
            if (!segmentation || !this.settings.segmentationMode || detection.class !== 'person') {
                this.drawDetection(detection);
            } else if (this.settings.showLabels && detection.class === 'person') {
                // Still show labels for segmented persons
                const { bbox, class: className, confidence } = detection;
                const label = `${className} ${Math.round(confidence * 100)}%`;
                this.ctx.font = '14px Inter, sans-serif';
                const textMetrics = this.ctx.measureText(label);
                const textHeight = 20;
                const padding = 6;

                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                this.ctx.fillRect(bbox.x, bbox.y - textHeight - padding, textMetrics.width + padding * 2, textHeight + padding);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText(label, bbox.x + padding, bbox.y - padding);
            }
        }
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Export
window.Renderer = Renderer;
