/**
 * YOLO Vision 2.0 - Renderer Module
 * Canvas rendering with segmentation, background replacement, and smoothing
 */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Offscreen canvas for compositing
        this.offCanvas = document.createElement('canvas');
        this.offCtx = this.offCanvas.getContext('2d');

        // Previous mask for temporal smoothing
        this.prevMask = null;

        // Settings
        this.settings = {
            vizMode: 'both',
            colorMode: 'fixed',
            fillColor: '#ffffff',
            outlineColor: '#ffffff',
            bgColor: '#000000',
            fillOpacity: 0.5,
            outlineThickness: 3,
            showLabels: true,
            segmentationMode: true,
            bgReplace: false,
            smoothing: 2
        };

        // Presets
        this.presets = {
            'E': { fillColor: '#00ff00', outlineColor: '#39ff14', fillOpacity: 0.4, outlineThickness: 4, vizMode: 'both' },
            'R': { fillColor: '#ff0000', outlineColor: '#ff0000', fillOpacity: 0.3, outlineThickness: 5, vizMode: 'outline' },
            'T': { fillColor: '#00ff00', outlineColor: '#00aa00', fillOpacity: 0.6, outlineThickness: 2, vizMode: 'both' },
            'Z': { fillColor: '#ff00ff', outlineColor: '#00ffff', fillOpacity: 0.5, outlineThickness: 3, vizMode: 'both' },
            'U': { fillColor: '#ffffff', outlineColor: '#ffffff', fillOpacity: 0.2, outlineThickness: 2, vizMode: 'outline' },
            'I': { fillColor: '#000000', outlineColor: '#ffffff', fillOpacity: 0.8, outlineThickness: 2, vizMode: 'both' },
            'O': { fillColor: '#ffa500', outlineColor: '#ff4500', fillOpacity: 0.5, outlineThickness: 4, vizMode: 'both' }
        };
    }

    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }

    applyPreset(key) {
        if (this.presets[key]) {
            Object.assign(this.settings, this.presets[key]);
            return this.presets[key];
        }
        return null;
    }

    hexToRGB(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    hexToRGBA(hex, alpha) {
        const [r, g, b] = this.hexToRGB(hex);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Apply smoothing between frames (temporal averaging)
     */
    smoothMask(currentMask, width, height) {
        if (this.settings.smoothing === 0 || !this.prevMask || this.prevMask.length !== currentMask.length) {
            this.prevMask = new Float32Array(currentMask);
            return currentMask;
        }

        const factor = this.settings.smoothing / 10;
        const smoothed = new Uint8Array(currentMask.length);

        for (let i = 0; i < currentMask.length; i++) {
            // Blend with previous frame
            const blended = this.prevMask[i] * factor + currentMask[i] * (1 - factor);
            smoothed[i] = blended > 0.5 ? 1 : 0;
            this.prevMask[i] = blended;
        }

        return smoothed;
    }

    /**
     * Apply spatial smoothing (blur the mask edges)
     */
    blurMask(maskData, width, height, iterations = 1) {
        if (iterations === 0) return maskData;

        let data = new Float32Array(maskData);

        for (let iter = 0; iter < iterations; iter++) {
            const newData = new Float32Array(data.length);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let sum = 0;
                    let count = 0;

                    // 3x3 kernel
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                sum += data[ny * width + nx];
                                count++;
                            }
                        }
                    }

                    newData[y * width + x] = sum / count;
                }
            }

            data = newData;
        }

        // Convert back to binary with threshold
        const result = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] > 0.5 ? 1 : 0;
        }

        return result;
    }

    /**
     * Draw segmentation with background replacement option
     */
    drawSegmentation(video, segmentation) {
        if (!segmentation || !segmentation.data) return;

        const width = segmentation.width;
        const height = segmentation.height;

        // Apply smoothing
        let maskData = this.smoothMask(segmentation.data, width, height);
        maskData = this.blurMask(maskData, width, height, Math.floor(this.settings.smoothing / 3));

        const fillRGB = this.hexToRGB(this.settings.fillColor);
        const outlineRGB = this.hexToRGB(this.settings.outlineColor);
        const bgRGB = this.hexToRGB(this.settings.bgColor);
        const alpha = Math.round(this.settings.fillOpacity * 255);

        // Resize offscreen canvas
        this.offCanvas.width = width;
        this.offCanvas.height = height;

        // Draw video to offscreen at mask resolution
        this.offCtx.drawImage(video, 0, 0, width, height);
        const videoData = this.offCtx.getImageData(0, 0, width, height);

        // Create output image
        const outputData = this.ctx.createImageData(this.canvas.width, this.canvas.height);

        // Get scale factors
        const scaleX = this.canvas.width / width;
        const scaleY = this.canvas.height / height;

        // Process each pixel
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                // Map to mask coordinates
                const maskX = Math.floor(x / scaleX);
                const maskY = Math.floor(y / scaleY);
                const maskIdx = maskY * width + maskX;

                const isSegmented = maskData[maskIdx] === 1;
                const outIdx = (y * this.canvas.width + x) * 4;

                // Get video pixel
                const vidIdx = (maskY * width + maskX) * 4;
                const vidR = videoData.data[vidIdx];
                const vidG = videoData.data[vidIdx + 1];
                const vidB = videoData.data[vidIdx + 2];

                if (this.settings.bgReplace) {
                    // Background replacement mode
                    if (isSegmented) {
                        // Show person with optional overlay
                        if (this.settings.vizMode === 'fill' || this.settings.vizMode === 'both') {
                            const blend = this.settings.fillOpacity;
                            outputData.data[outIdx] = vidR * (1 - blend) + fillRGB[0] * blend;
                            outputData.data[outIdx + 1] = vidG * (1 - blend) + fillRGB[1] * blend;
                            outputData.data[outIdx + 2] = vidB * (1 - blend) + fillRGB[2] * blend;
                        } else {
                            outputData.data[outIdx] = vidR;
                            outputData.data[outIdx + 1] = vidG;
                            outputData.data[outIdx + 2] = vidB;
                        }
                        outputData.data[outIdx + 3] = 255;
                    } else {
                        // Replace background with solid color
                        outputData.data[outIdx] = bgRGB[0];
                        outputData.data[outIdx + 1] = bgRGB[1];
                        outputData.data[outIdx + 2] = bgRGB[2];
                        outputData.data[outIdx + 3] = 255;
                    }
                } else {
                    // Normal overlay mode - draw video first
                    outputData.data[outIdx] = vidR;
                    outputData.data[outIdx + 1] = vidG;
                    outputData.data[outIdx + 2] = vidB;
                    outputData.data[outIdx + 3] = 255;

                    if (isSegmented && (this.settings.vizMode === 'fill' || this.settings.vizMode === 'both')) {
                        const blend = this.settings.fillOpacity;
                        outputData.data[outIdx] = vidR * (1 - blend) + fillRGB[0] * blend;
                        outputData.data[outIdx + 1] = vidG * (1 - blend) + fillRGB[1] * blend;
                        outputData.data[outIdx + 2] = vidB * (1 - blend) + fillRGB[2] * blend;
                    }
                }
            }
        }

        // Put the processed image
        this.ctx.putImageData(outputData, 0, 0);

        // Draw outlines
        if (this.settings.vizMode === 'outline' || this.settings.vizMode === 'both') {
            this.drawOutline(maskData, width, height, outlineRGB);
        }
    }

    drawOutline(maskData, maskWidth, maskHeight, color) {
        const scaleX = this.canvas.width / maskWidth;
        const scaleY = this.canvas.height / maskHeight;

        this.ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        this.ctx.lineWidth = this.settings.outlineThickness;

        // Find edge pixels and draw them
        for (let y = 0; y < maskHeight; y++) {
            for (let x = 0; x < maskWidth; x++) {
                const i = y * maskWidth + x;
                if (maskData[i] === 1) {
                    let isEdge = false;
                    for (let dy = -1; dy <= 1 && !isEdge; dy++) {
                        for (let dx = -1; dx <= 1 && !isEdge; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < maskWidth && ny >= 0 && ny < maskHeight) {
                                if (maskData[ny * maskWidth + nx] === 0) {
                                    isEdge = true;
                                }
                            }
                        }
                    }
                    if (isEdge) {
                        this.ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                        this.ctx.fillRect(
                            x * scaleX,
                            y * scaleY,
                            Math.max(scaleX, this.settings.outlineThickness),
                            Math.max(scaleY, this.settings.outlineThickness)
                        );
                    }
                }
            }
        }
    }

    drawDetection(detection) {
        const { bbox, class: className, confidence } = detection;
        const { x, y, width, height } = bbox;

        const fillColor = this.settings.fillColor;
        const outlineColor = this.settings.outlineColor;

        if (this.settings.vizMode === 'fill' || this.settings.vizMode === 'both') {
            this.ctx.fillStyle = this.hexToRGBA(fillColor, this.settings.fillOpacity);
            this.ctx.fillRect(x, y, width, height);
        }

        if (this.settings.vizMode === 'outline' || this.settings.vizMode === 'both') {
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = this.settings.outlineThickness;
            this.ctx.strokeRect(x, y, width, height);
        }

        if (this.settings.showLabels) {
            const label = `${className} ${Math.round(confidence * 100)}%`;
            this.ctx.font = '12px "JetBrains Mono", monospace';
            const textMetrics = this.ctx.measureText(label);

            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x, y - 16, textMetrics.width + 8, 16);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(label, x + 4, y - 4);
        }
    }

    render(video, detections, segmentation = null) {
        if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
            this.canvas.width = video.videoWidth;
            this.canvas.height = video.videoHeight;
        }

        if (segmentation && this.settings.segmentationMode) {
            this.drawSegmentation(video, segmentation);
        } else {
            this.ctx.drawImage(video, 0, 0);
        }

        // Draw bounding boxes for non-person objects
        for (const detection of detections) {
            if (!segmentation || !this.settings.segmentationMode || detection.class !== 'person') {
                this.drawDetection(detection);
            } else if (this.settings.showLabels && detection.class === 'person') {
                const { bbox, confidence } = detection;
                const label = `person ${Math.round(confidence * 100)}%`;
                this.ctx.font = '12px "JetBrains Mono", monospace';
                const textMetrics = this.ctx.measureText(label);

                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(bbox.x, bbox.y - 16, textMetrics.width + 8, 16);

                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText(label, bbox.x + 4, bbox.y - 4);
            }
        }
    }

    clear() {
        this.ctx.fillStyle = this.settings.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

window.Renderer = Renderer;
