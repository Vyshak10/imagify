// Imagify - Image Compression & Quality Analysis
class Imagify {
    constructor() {
        this.originalImage = null;
        this.compressedImage = null;
        this.originalCanvas = document.getElementById('originalCanvas');
        this.compressedCanvas = document.getElementById('compressedCanvas');
        this.differenceCanvas = document.getElementById('differenceCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
        this.compressedCtx = this.compressedCanvas.getContext('2d');
        this.differenceCtx = this.differenceCanvas.getContext('2d');
        
        this.currentQuality = 75;
        this.currentFormat = 'jpeg';
        this.originalSize = 0;
        this.compressedSize = 0;
        
        this.initializeEventListeners();
        this.initializeMLModel();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const browseBtn = document.getElementById('browseBtn');
        const qualitySlider = document.getElementById('qualitySlider');
        const qualityValue = document.getElementById('qualityValue');
        const formatRadios = document.querySelectorAll('input[name="format"]');
        const diffToggle = document.getElementById('diffToggle');
        const downloadBtn = document.getElementById('downloadBtn');
        const resetBtn = document.getElementById('resetBtn');

        // File upload handlers - improved with better event handling
        const triggerFileInput = (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        };

        uploadArea.addEventListener('click', triggerFileInput);
        browseBtn.addEventListener('click', triggerFileInput);
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Drag and drop handlers - improved
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        // Quality slider
        qualitySlider.addEventListener('input', (e) => {
            this.currentQuality = parseInt(e.target.value);
            qualityValue.textContent = this.currentQuality;
            this.debounceCompress();
        });

        // Format selection
        formatRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.currentFormat = e.target.value;
                    if (this.originalImage) {
                        this.compressImage();
                    }
                }
            });
        });

        // Difference toggle
        diffToggle.addEventListener('change', (e) => {
            const container = document.getElementById('differenceContainer');
            if (e.target.checked && this.originalImage && this.compressedImage) {
                container.classList.remove('hidden');
                this.generateDifferenceMap();
            } else {
                container.classList.add('hidden');
            }
        });

        // Action buttons
        downloadBtn.addEventListener('click', () => this.downloadCompressedImage());
        resetBtn.addEventListener('click', () => this.resetApplication());
    }

    initializeMLModel() {
        // Simple ML model weights for quality prediction
        this.mlWeights = {
            compressionRatio: 0.4,
            estimatedPSNR: 0.3,
            imageComplexity: 0.2,
            colorVariance: 0.1
        };
    }

    debounceCompress() {
        clearTimeout(this.compressTimeout);
        this.compressTimeout = setTimeout(() => {
            this.compressImage();
        }, 300);
    }

    async handleFileSelect(file) {
        if (!file) {
            console.log('No file selected');
            return;
        }

        console.log('File selected:', file.name, file.type, file.size);

        // Validate file type and size
        const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const fileType = file.type.toLowerCase();
        
        if (!supportedTypes.includes(fileType) && !file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)) {
            alert('Please select a valid image file (PNG, JPG, or WebP)');
            return;
        }

        if (file.size > 10485760) { // 10MB
            alert('File size must be less than 10MB');
            return;
        }

        this.showProcessing(true);
        this.originalSize = file.size;

        try {
            // Load image
            const img = await this.loadImage(file);
            this.originalImage = img;
            
            console.log('Image loaded successfully:', img.width, img.height);
            
            // Display original image
            this.displayImage(img, this.originalCanvas, this.originalCtx);
            
            // Show UI sections
            this.showSections();
            
            // Initial compression
            await this.compressImage();
            
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Error loading image. Please try again.');
        }

        this.showProcessing(false);
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }

    displayImage(img, canvas, ctx) {
        const maxWidth = 400;
        const maxHeight = 400;
        
        let { width, height } = img;
        
        // Calculate scaled dimensions
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
    }

    async compressImage() {
        if (!this.originalImage) return;

        this.showProcessing(true);

        try {
            // Create temporary canvas for compression
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = this.originalImage.width;
            tempCanvas.height = this.originalImage.height;
            tempCtx.drawImage(this.originalImage, 0, 0);

            // Compress image
            const mimeType = this.currentFormat === 'webp' ? 'image/webp' : 'image/jpeg';
            const quality = this.currentQuality / 100;
            
            const compressedDataUrl = tempCanvas.toDataURL(mimeType, quality);
            
            // Calculate compressed size (approximate)
            this.compressedSize = Math.round((compressedDataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
            
            // Load compressed image
            const compressedImg = new Image();
            compressedImg.onload = () => {
                this.compressedImage = compressedImg;
                this.displayImage(compressedImg, this.compressedCanvas, this.compressedCtx);
                this.updateMetrics();
                this.updateFileSizeDisplay();
                
                // Update difference map if enabled
                const diffToggle = document.getElementById('diffToggle');
                if (diffToggle && diffToggle.checked) {
                    this.generateDifferenceMap();
                }
            };
            compressedImg.src = compressedDataUrl;

        } catch (error) {
            console.error('Error compressing image:', error);
            alert('Error compressing image. Please try again.');
        }

        this.showProcessing(false);
    }

    calculatePSNR(img1, img2) {
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');
        
        const width = Math.min(img1.width, img2.width);
        const height = Math.min(img1.height, img2.height);
        
        canvas1.width = canvas2.width = width;
        canvas1.height = canvas2.height = height;
        
        ctx1.drawImage(img1, 0, 0, width, height);
        ctx2.drawImage(img2, 0, 0, width, height);
        
        const data1 = ctx1.getImageData(0, 0, width, height).data;
        const data2 = ctx2.getImageData(0, 0, width, height).data;
        
        let mse = 0;
        for (let i = 0; i < data1.length; i += 4) {
            // Calculate MSE for RGB channels
            const r = Math.pow(data1[i] - data2[i], 2);
            const g = Math.pow(data1[i + 1] - data2[i + 1], 2);
            const b = Math.pow(data1[i + 2] - data2[i + 2], 2);
            mse += (r + g + b) / 3;
        }
        
        mse /= (width * height);
        
        if (mse === 0) return 100; // Perfect match
        
        const psnr = 20 * Math.log10(255 / Math.sqrt(mse));
        return Math.max(0, Math.min(100, psnr));
    }

    calculateSSIM(img1, img2) {
        // Simplified SSIM calculation based on luminance
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');
        
        const width = Math.min(img1.width, img2.width);
        const height = Math.min(img1.height, img2.height);
        
        canvas1.width = canvas2.width = width;
        canvas1.height = canvas2.height = height;
        
        ctx1.drawImage(img1, 0, 0, width, height);
        ctx2.drawImage(img2, 0, 0, width, height);
        
        const data1 = ctx1.getImageData(0, 0, width, height).data;
        const data2 = ctx2.getImageData(0, 0, width, height).data;
        
        let mean1 = 0, mean2 = 0;
        const numPixels = width * height;
        
        // Calculate means
        for (let i = 0; i < data1.length; i += 4) {
            mean1 += (data1[i] * 0.299 + data1[i + 1] * 0.587 + data1[i + 2] * 0.114);
            mean2 += (data2[i] * 0.299 + data2[i + 1] * 0.587 + data2[i + 2] * 0.114);
        }
        
        mean1 /= numPixels;
        mean2 /= numPixels;
        
        let variance1 = 0, variance2 = 0, covariance = 0;
        
        // Calculate variances and covariance
        for (let i = 0; i < data1.length; i += 4) {
            const lum1 = data1[i] * 0.299 + data1[i + 1] * 0.587 + data1[i + 2] * 0.114;
            const lum2 = data2[i] * 0.299 + data2[i + 1] * 0.587 + data2[i + 2] * 0.114;
            
            variance1 += Math.pow(lum1 - mean1, 2);
            variance2 += Math.pow(lum2 - mean2, 2);
            covariance += (lum1 - mean1) * (lum2 - mean2);
        }
        
        variance1 /= numPixels - 1;
        variance2 /= numPixels - 1;
        covariance /= numPixels - 1;
        
        // SSIM constants
        const c1 = Math.pow(0.01 * 255, 2);
        const c2 = Math.pow(0.03 * 255, 2);
        
        const numerator = (2 * mean1 * mean2 + c1) * (2 * covariance + c2);
        const denominator = (mean1 * mean1 + mean2 * mean2 + c1) * (variance1 + variance2 + c2);
        
        return Math.max(0, Math.min(1, numerator / denominator));
    }

    calculateImageComplexity(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        let edgeCount = 0;
        
        // Simple edge detection
        for (let i = 0; i < data.length - 4; i += 4) {
            const current = data[i] + data[i + 1] + data[i + 2];
            const next = data[i + 4] + data[i + 5] + data[i + 6];
            if (Math.abs(current - next) > 100) {
                edgeCount++;
            }
        }
        
        return edgeCount / (img.width * img.height);
    }

    calculateColorVariance(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        let rSum = 0, gSum = 0, bSum = 0;
        const numPixels = img.width * img.height;
        
        // Calculate means
        for (let i = 0; i < data.length; i += 4) {
            rSum += data[i];
            gSum += data[i + 1];
            bSum += data[i + 2];
        }
        
        const rMean = rSum / numPixels;
        const gMean = gSum / numPixels;
        const bMean = bSum / numPixels;
        
        let variance = 0;
        
        // Calculate variance
        for (let i = 0; i < data.length; i += 4) {
            variance += Math.pow(data[i] - rMean, 2);
            variance += Math.pow(data[i + 1] - gMean, 2);
            variance += Math.pow(data[i + 2] - bMean, 2);
        }
        
        return variance / (numPixels * 3);
    }

    predictQualityScore() {
        if (!this.originalImage || !this.compressedImage) return 0;
        
        const compressionRatio = this.originalSize / this.compressedSize;
        const psnr = this.calculatePSNR(this.originalImage, this.compressedImage);
        const imageComplexity = this.calculateImageComplexity(this.originalImage);
        const colorVariance = this.calculateColorVariance(this.originalImage);
        
        // Normalize features
        const normalizedRatio = Math.min(1, compressionRatio / 10);
        const normalizedPSNR = Math.min(1, psnr / 50);
        const normalizedComplexity = Math.min(1, imageComplexity);
        const normalizedVariance = Math.min(1, colorVariance / 10000);
        
        // Calculate weighted score
        const score = (
            normalizedRatio * this.mlWeights.compressionRatio +
            normalizedPSNR * this.mlWeights.estimatedPSNR +
            (1 - normalizedComplexity) * this.mlWeights.imageComplexity +
            normalizedVariance * this.mlWeights.colorVariance
        ) * 100;
        
        return Math.max(0, Math.min(100, score));
    }

    updateMetrics() {
        if (!this.originalImage || !this.compressedImage) return;
        
        const psnr = this.calculatePSNR(this.originalImage, this.compressedImage);
        const ssim = this.calculateSSIM(this.originalImage, this.compressedImage);
        const compressionRatio = this.originalSize / this.compressedSize;
        const qualityScore = this.predictQualityScore();
        
        document.getElementById('psnrValue').textContent = psnr.toFixed(1);
        document.getElementById('ssimValue').textContent = ssim.toFixed(3);
        document.getElementById('ratioValue').textContent = compressionRatio.toFixed(1) + ':1';
        document.getElementById('qualityScore').textContent = qualityScore.toFixed(0) + '%';
    }

    updateFileSizeDisplay() {
        const formatSize = (size) => {
            if (size < 1024) return size + ' B';
            if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
            return (size / (1024 * 1024)).toFixed(1) + ' MB';
        };
        
        document.getElementById('originalSize').textContent = formatSize(this.originalSize);
        document.getElementById('compressedSize').textContent = formatSize(this.compressedSize);
    }

    generateDifferenceMap() {
        if (!this.originalImage || !this.compressedImage) return;
        
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');
        
        const width = Math.min(this.originalImage.width, this.compressedImage.width);
        const height = Math.min(this.originalImage.height, this.compressedImage.height);
        
        canvas1.width = canvas2.width = width;
        canvas1.height = canvas2.height = height;
        
        ctx1.drawImage(this.originalImage, 0, 0, width, height);
        ctx2.drawImage(this.compressedImage, 0, 0, width, height);
        
        const data1 = ctx1.getImageData(0, 0, width, height).data;
        const data2 = ctx2.getImageData(0, 0, width, height).data;
        
        // Scale canvas for display
        const maxDisplayWidth = 400;
        const maxDisplayHeight = 300;
        let displayWidth = width;
        let displayHeight = height;
        
        if (width > maxDisplayWidth || height > maxDisplayHeight) {
            const ratio = Math.min(maxDisplayWidth / width, maxDisplayHeight / height);
            displayWidth = Math.floor(width * ratio);
            displayHeight = Math.floor(height * ratio);
        }
        
        this.differenceCanvas.width = displayWidth;
        this.differenceCanvas.height = displayHeight;
        
        const diffImageData = this.differenceCtx.createImageData(width, height);
        const diffData = diffImageData.data;
        
        // Calculate differences and create heatmap
        for (let i = 0; i < data1.length; i += 4) {
            const diff = Math.abs(data1[i] - data2[i]) + 
                        Math.abs(data1[i + 1] - data2[i + 1]) + 
                        Math.abs(data1[i + 2] - data2[i + 2]);
            
            const normalizedDiff = diff / (3 * 255);
            
            // Create heatmap coloring (blue to red)
            if (normalizedDiff < 0.1) {
                diffData[i] = 0;     // R
                diffData[i + 1] = 0; // G
                diffData[i + 2] = 128; // B
            } else if (normalizedDiff < 0.3) {
                diffData[i] = Math.floor(255 * normalizedDiff * 2);
                diffData[i + 1] = 215;
                diffData[i + 2] = 0;
            } else {
                diffData[i] = 255;
                diffData[i + 1] = 0;
                diffData[i + 2] = 0;
            }
            
            diffData[i + 3] = 255; // Alpha
        }
        
        // Draw scaled difference map
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.putImageData(diffImageData, 0, 0);
        
        this.differenceCtx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
    }

    downloadCompressedImage() {
        if (!this.compressedCanvas || !this.originalImage) {
            alert('Please upload and compress an image first');
            return;
        }
        
        const mimeType = this.currentFormat === 'webp' ? 'image/webp' : 'image/jpeg';
        const quality = this.currentQuality / 100;
        
        // Create a full-size canvas for download
        const downloadCanvas = document.createElement('canvas');
        const downloadCtx = downloadCanvas.getContext('2d');
        
        downloadCanvas.width = this.originalImage.width;
        downloadCanvas.height = this.originalImage.height;
        downloadCtx.drawImage(this.originalImage, 0, 0);
        
        const link = document.createElement('a');
        link.download = `imagify-compressed-${this.currentQuality}q.${this.currentFormat === 'webp' ? 'webp' : 'jpg'}`;
        link.href = downloadCanvas.toDataURL(mimeType, quality);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showSections() {
        const sections = [
            'controlsSection',
            'comparisonSection', 
            'metricsSection',
            'differenceSection',
            'actionsSection'
        ];
        
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.remove('hidden');
                section.classList.add('fade-in');
            }
        });
    }

    showProcessing(show) {
        const indicator = document.getElementById('processingIndicator');
        if (show) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }

    resetApplication() {
        // Reset all state
        this.originalImage = null;
        this.compressedImage = null;
        this.originalSize = 0;
        this.compressedSize = 0;
        this.currentQuality = 75;
        this.currentFormat = 'jpeg';
        
        // Clear canvases
        if (this.originalCanvas) {
            this.originalCtx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
            this.originalCanvas.width = 0;
            this.originalCanvas.height = 0;
        }
        if (this.compressedCanvas) {
            this.compressedCtx.clearRect(0, 0, this.compressedCanvas.width, this.compressedCanvas.height);
            this.compressedCanvas.width = 0;
            this.compressedCanvas.height = 0;
        }
        if (this.differenceCanvas) {
            this.differenceCtx.clearRect(0, 0, this.differenceCanvas.width, this.differenceCanvas.height);
            this.differenceCanvas.width = 0;
            this.differenceCanvas.height = 0;
        }
        
        // Reset UI elements
        document.getElementById('qualitySlider').value = 75;
        document.getElementById('qualityValue').textContent = '75';
        document.querySelector('input[name="format"][value="jpeg"]').checked = true;
        document.getElementById('diffToggle').checked = false;
        document.getElementById('differenceContainer').classList.add('hidden');
        
        // Clear metrics
        document.getElementById('psnrValue').textContent = '-';
        document.getElementById('ssimValue').textContent = '-';
        document.getElementById('ratioValue').textContent = '-';
        document.getElementById('qualityScore').textContent = '-';
        document.getElementById('originalSize').textContent = '-';
        document.getElementById('compressedSize').textContent = '-';
        
        // Hide sections
        const sections = [
            'controlsSection',
            'comparisonSection', 
            'metricsSection',
            'differenceSection',
            'actionsSection'
        ];
        
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('hidden');
                section.classList.remove('fade-in');
            }
        });
        
        // Clear file input
        document.getElementById('fileInput').value = '';
        
        // Remove dragover class if present
        document.getElementById('uploadArea').classList.remove('dragover');
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Imagify...');
    try {
        new Imagify();
        console.log('Imagify initialized successfully');
    } catch (error) {
        console.error('Error initializing Imagify:', error);
    }
});