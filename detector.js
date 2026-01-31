/**
 * YOLO Vision 2.0 - Detector Module
 * TensorFlow.js COCO-SSD + BodyPix for detection and segmentation
 */

class Detector {
    constructor() {
        this.cocoModel = null;
        this.bodyPixModel = null;
        this.isReady = false;
        this.confidence = 0.5;
        this.personOnly = false;
        this.mode = 'detection'; // 'detection' or 'segmentation'
    }

    /**
     * Load models
     */
    async load(onProgress) {
        try {
            // Load COCO-SSD for object detection
            if (onProgress) onProgress('Loading COCO-SSD model...');
            console.log('Loading COCO-SSD model...');
            this.cocoModel = await cocoSsd.load({
                base: 'lite_mobilenet_v2'
            });
            console.log('COCO-SSD loaded!');

            // Load BodyPix for segmentation
            if (onProgress) onProgress('Loading BodyPix model...');
            console.log('Loading BodyPix model...');
            this.bodyPixModel = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });
            console.log('BodyPix loaded!');

            this.isReady = true;
            return true;
        } catch (error) {
            console.error('Failed to load models:', error);
            throw error;
        }
    }

    /**
     * Set detection mode
     */
    setMode(mode) {
        this.mode = mode; // 'detection' or 'segmentation'
    }

    /**
     * Set confidence threshold
     */
    setConfidence(value) {
        this.confidence = Math.max(0, Math.min(1, value));
    }

    /**
     * Set person-only mode
     */
    setPersonOnly(enabled) {
        this.personOnly = enabled;
    }

    /**
     * Detect objects using COCO-SSD
     */
    async detect(source) {
        if (!this.isReady || !this.cocoModel) {
            return { detections: [], segmentation: null };
        }

        try {
            let detections = [];
            let segmentation = null;

            // Object detection with COCO-SSD
            const predictions = await this.cocoModel.detect(source);

            // Filter by confidence and optionally by class
            let filtered = predictions.filter(pred => pred.score >= this.confidence);

            if (this.personOnly) {
                filtered = filtered.filter(pred => pred.class === 'person');
            }

            detections = filtered.map(pred => ({
                class: pred.class,
                confidence: pred.score,
                bbox: {
                    x: pred.bbox[0],
                    y: pred.bbox[1],
                    width: pred.bbox[2],
                    height: pred.bbox[3]
                }
            }));

            // Person segmentation with BodyPix (if in segmentation mode)
            if (this.mode === 'segmentation' && this.bodyPixModel) {
                segmentation = await this.bodyPixModel.segmentPerson(source, {
                    flipHorizontal: false,
                    internalResolution: 'medium',
                    segmentationThreshold: 0.7
                });
            }

            return { detections, segmentation };
        } catch (error) {
            console.error('Detection error:', error);
            return { detections: [], segmentation: null };
        }
    }

    /**
     * Get segmentation mask only (for performance)
     */
    async segment(source) {
        if (!this.isReady || !this.bodyPixModel) {
            return null;
        }

        try {
            return await this.bodyPixModel.segmentPerson(source, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.7
            });
        } catch (error) {
            console.error('Segmentation error:', error);
            return null;
        }
    }

    /**
     * Get multi-person segmentation with parts
     */
    async segmentMultiPerson(source) {
        if (!this.isReady || !this.bodyPixModel) {
            return null;
        }

        try {
            return await this.bodyPixModel.segmentMultiPerson(source, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.7,
                maxDetections: 10,
                scoreThreshold: 0.3,
                nmsRadius: 20
            });
        } catch (error) {
            console.error('Multi-person segmentation error:', error);
            return null;
        }
    }
}

// Export for use in other modules
window.Detector = Detector;
