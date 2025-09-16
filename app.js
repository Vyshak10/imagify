// Imagify - Image Compression Application
class Imagify {
    constructor() {
        this.originalImage = null;
        this.originalCanvas = document.getElementById('originalCanvas');
        this.compressedCanvas = document.getElementById('compressedCanvas');
        this.heatMapCanvas = document.getElementById('heatMapCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
        this.compressedCtx = this.compressedCanvas.getContext('2d');
        this.heatMapCtx = this.heatMapCanvas.getContext('2d');
        
        this.currentQuality = 80;
        this.originalSize = 0;
        this.compressedBlob = null;
        this.isProcessing = false;
        this.debounceTimer = null;
        this.dragCounter = 0; // Fix for drag state persistence
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File upload handlers with proper drag state management
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileSelectBtn = document.getElementById('fileSelectBtn');

        // Fix drag events with counter to handle multiple enter/leave events
        uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragCounter++;
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragCounter--;
            if (this.dragCounter === 0) {
                uploadArea.classList.remove('dragover');
            }
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragCounter = 0;
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        // Fix file input handler - only the button should trigger file selection
        fileSelectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.value = ''; // Clear previous selection
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Only allow clicking on specific elements within upload area to trigger file selection
        uploadArea.addEventListener('click', (e) => {
            // Only trigger if clicking on the upload area itself, upload icon, or text (not buttons)
            const clickableElements = [uploadArea, uploadArea.querySelector('.upload-icon'), uploadArea.querySelector('h3')];
            const uploadInfo = uploadArea.querySelector('.upload-info');
            if (uploadInfo) clickableElements.push(uploadInfo);
            
            if (clickableElements.includes(e.target) && e.target !== fileSelectBtn) {
                fileInput.click();
            }
        });

        // Control handlers
        const qualitySlider = document.getElementById('qualitySlider');
        qualitySlider.addEventListener('input', (e) => {
            this.currentQuality = parseInt(e.target.value);
            document.getElementById('qualityValue').textContent = this.currentQuality;
            this.debounceCompression();
        });

        const maxWidthInput = document.getElementById('maxWidth');
        maxWidthInput.addEventListener('input', () => {
            this.debounceCompression();
        });

        const maxHeightInput = document.getElementById('maxHeight');
        maxHeightInput.addEventListener('input', () => {
            this.debounceCompression();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetToOriginal();
        });

        document.getElementById('heatMapToggle').addEventListener('click', () => {
            this.toggleHeatMap();
        });

        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadCompressed();
        });
    }

    debounceCompression() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            if (this.originalImage) {
                this.compressImage();
            }
        }, 250);
    }

    handleFileSelect(file) {
        // Reset drag counter and state
        this.dragCounter = 0;
        document.getElementById('uploadArea').classList.remove('dragover');
        
        // Validate file
        if (!file) {
            this.showError('No file selected.');
            return;
        }

        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file (JPG, PNG, WebP).');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('File size must be less than 10MB.');
            return;
        }

        this.originalSize = file.size;
        this.showLoading(true);
        this.hideError();

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayOriginalImage();
                this.compressImage();
                this.showMainContent();
                this.showLoading(false);
            };
            img.onerror = () => {
                this.showError('Failed to load image. Please try another file.');
                this.showLoading(false);
            };
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            this.showError('Failed to read file. Please try again.');
            this.showLoading(false);
        };
        
        reader.readAsDataURL(file);
    }

    displayOriginalImage() {
        const img = this.originalImage;
        const maxDisplayWidth = 400;
        const maxDisplayHeight = 400;
        
        let { width, height } = this.calculateDisplaySize(img.width, img.height, maxDisplayWidth, maxDisplayHeight);
        
        this.originalCanvas.width = width;
        this.originalCanvas.height = height;
        
        // Clear canvas and draw image
        this.originalCtx.clearRect(0, 0, width, height);
        this.originalCtx.drawImage(img, 0, 0, width, height);
        
        document.getElementById('originalSize').textContent = this.formatFileSize(this.originalSize);
    }

    calculateDisplaySize(originalWidth, originalHeight, maxWidth, maxHeight) {
        let width = originalWidth;
        let height = originalHeight;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        
        return { width, height };
    }

    calculateCompressionSize() {
        const maxWidthValue = document.getElementById('maxWidth').value;
        const maxHeightValue = document.getElementById('maxHeight').value;
        
        const maxWidth = maxWidthValue ? parseInt(maxWidthValue) : this.originalImage.width;
        const maxHeight = maxHeightValue ? parseInt(maxHeightValue) : this.originalImage.height;
        
        let width = this.originalImage.width;
        let height = this.originalImage.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        
        return { width, height };
    }

    compressImage() {
        if (this.isProcessing || !this.originalImage) return;
        this.isProcessing = true;
        
        try {
            const { width: compressedWidth, height: compressedHeight } = this.calculateCompressionSize();
            const { width: displayWidth, height: displayHeight } = this.calculateDisplaySize(compressedWidth, compressedHeight, 400, 400);
            
            // Create a temporary canvas for compression
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = compressedWidth;
            tempCanvas.height = compressedHeight;
            tempCtx.drawImage(this.originalImage, 0, 0, compressedWidth, compressedHeight);
            
            // Compress and get blob
            tempCanvas.toBlob((blob) => {
                if (!blob) {
                    this.showError('Failed to compress image. Please try again.');
                    this.isProcessing = false;
                    return;
                }
                
                this.compressedBlob = blob;
                
                // Display compressed image
                this.compressedCanvas.width = displayWidth;
                this.compressedCanvas.height = displayHeight;
                
                const img = new Image();
                img.onload = () => {
                    this.compressedCtx.clearRect(0, 0, displayWidth, displayHeight);
                    this.compressedCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
                    
                    // Update metrics
                    this.calculateMetrics(tempCanvas, blob);
                    this.updateHeatMap(tempCanvas);
                    this.isProcessing = false;
                    
                    URL.revokeObjectURL(img.src); // Clean up
                };
                img.onerror = () => {
                    this.showError('Failed to display compressed image.');
                    this.isProcessing = false;
                };
                img.src = URL.createObjectURL(blob);
                
            }, 'image/jpeg', this.currentQuality / 100);
        } catch (error) {
            this.showError('Error during compression: ' + error.message);
            this.isProcessing = false;
        }
    }

    calculateMetrics(compressedCanvas, compressedBlob) {
        try {
            // Create canvas with original image at compressed size for fair comparison
            const originalResizedCanvas = document.createElement('canvas');
            const originalResizedCtx = originalResizedCanvas.getContext('2d');
            originalResizedCanvas.width = compressedCanvas.width;
            originalResizedCanvas.height = compressedCanvas.height;
            originalResizedCtx.drawImage(this.originalImage, 0, 0, compressedCanvas.width, compressedCanvas.height);
            
            const originalData = originalResizedCtx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
            const compressedData = compressedCanvas.getContext('2d').getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
            
            // Calculate PSNR
            const psnr = this.calculatePSNR(originalData, compressedData);
            
            // Calculate SSIM
            const ssim = this.calculateSSIM(originalData, compressedData);
            
            // Calculate compression metrics
            const compressionRatio = this.originalSize / compressedBlob.size;
            const sizeReduction = ((this.originalSize - compressedBlob.size) / this.originalSize) * 100;
            
            // Update UI with error checking
            const psnrElement = document.getElementById('psnrValue');
            const ssimElement = document.getElementById('ssimValue');
            const compressionElement = document.getElementById('compressionRatio');
            const sizeReductionElement = document.getElementById('sizeReduction');
            const compressedSizeElement = document.getElementById('compressedSize');
            
            if (psnrElement) psnrElement.textContent = psnr.toFixed(2);
            if (ssimElement) ssimElement.textContent = ssim.toFixed(4);
            if (compressionElement) compressionElement.textContent = compressionRatio.toFixed(1);
            if (sizeReductionElement) sizeReductionElement.textContent = sizeReduction.toFixed(1);
            if (compressedSizeElement) compressedSizeElement.textContent = this.formatFileSize(compressedBlob.size);
        } catch (error) {
            console.error('Error calculating metrics:', error);
        }
    }

    calculatePSNR(originalData, compressedData) {
        const pixels = originalData.data.length / 4;
        let mse = 0;
        
        for (let i = 0; i < originalData.data.length; i += 4) {
            const rDiff = originalData.data[i] - compressedData.data[i];
            const gDiff = originalData.data[i + 1] - compressedData.data[i + 1];
            const bDiff = originalData.data[i + 2] - compressedData.data[i + 2];
            
            mse += (rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) / 3;
        }
        
        mse /= pixels;
        
        if (mse === 0) return 100; // Perfect match
        
        const psnr = 10 * Math.log10((255 * 255) / mse);
        return Math.max(0, psnr);
    }

    calculateSSIM(originalData, compressedData) {
        // Simplified SSIM calculation (using luminance only for performance)
        const c1 = (0.01 * 255) ** 2;
        const c2 = (0.03 * 255) ** 2;
        
        let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        let pixels = 0;
        
        for (let i = 0; i < originalData.data.length; i += 4) {
            // Convert to luminance
            const x = 0.299 * originalData.data[i] + 0.587 * originalData.data[i + 1] + 0.114 * originalData.data[i + 2];
            const y = 0.299 * compressedData.data[i] + 0.587 * compressedData.data[i + 1] + 0.114 * compressedData.data[i + 2];
            
            sumX += x;
            sumY += y;
            sumX2 += x * x;
            sumY2 += y * y;
            sumXY += x * y;
            pixels++;
        }
        
        const meanX = sumX / pixels;
        const meanY = sumY / pixels;
        const varX = (sumX2 / pixels) - (meanX * meanX);
        const varY = (sumY2 / pixels) - (meanY * meanY);
        const covXY = (sumXY / pixels) - (meanX * meanY);
        
        const ssim = ((2 * meanX * meanY + c1) * (2 * covXY + c2)) / 
                     ((meanX * meanX + meanY * meanY + c1) * (varX + varY + c2));
        
        return Math.max(0, Math.min(1, ssim));
    }

    updateHeatMap(compressedCanvas) {
        const heatMapOverlay = document.getElementById('heatMapOverlay');
        if (!heatMapOverlay || heatMapOverlay.style.display === 'none') return;
        
        try {
            // Create canvas with original image at compressed size
            const originalResizedCanvas = document.createElement('canvas');
            const originalResizedCtx = originalResizedCanvas.getContext('2d');
            originalResizedCanvas.width = compressedCanvas.width;
            originalResizedCanvas.height = compressedCanvas.height;
            originalResizedCtx.drawImage(this.originalImage, 0, 0, compressedCanvas.width, compressedCanvas.height);
            
            const originalData = originalResizedCtx.getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
            const compressedData = compressedCanvas.getContext('2d').getImageData(0, 0, compressedCanvas.width, compressedCanvas.height);
            
            // Calculate heat map
            this.heatMapCanvas.width = this.compressedCanvas.width;
            this.heatMapCanvas.height = this.compressedCanvas.height;
            
            const heatMapData = this.heatMapCtx.createImageData(this.heatMapCanvas.width, this.heatMapCanvas.height);
            
            for (let i = 0; i < originalData.data.length; i += 4) {
                const rDiff = Math.abs(originalData.data[i] - compressedData.data[i]);
                const gDiff = Math.abs(originalData.data[i + 1] - compressedData.data[i + 1]);
                const bDiff = Math.abs(originalData.data[i + 2] - compressedData.data[i + 2]);
                
                const avgDiff = (rDiff + gDiff + bDiff) / 3;
                const intensity = avgDiff / 255; // Normalize to 0-1
                
                // Color mapping: blue (low) to red (high)
                const { r, g, b } = this.getHeatMapColor(intensity);
                
                heatMapData.data[i] = r;
                heatMapData.data[i + 1] = g;
                heatMapData.data[i + 2] = b;
                heatMapData.data[i + 3] = Math.max(50, intensity * 255); // Alpha based on intensity
            }
            
            this.heatMapCtx.putImageData(heatMapData, 0, 0);
        } catch (error) {
            console.error('Error updating heat map:', error);
        }
    }

    getHeatMapColor(intensity) {
        // Blue to red color mapping
        if (intensity < 0.5) {
            // Blue to yellow
            const t = intensity * 2;
            return {
                r: Math.round(t * 255),
                g: Math.round(t * 255),
                b: Math.round(255 * (1 - t))
            };
        } else {
            // Yellow to red
            const t = (intensity - 0.5) * 2;
            return {
                r: 255,
                g: Math.round(255 * (1 - t)),
                b: 0
            };
        }
    }

    toggleHeatMap() {
        const overlay = document.getElementById('heatMapOverlay');
        const toggleBtn = document.getElementById('heatMapToggle');
        
        if (!overlay || !toggleBtn) return;
        
        if (overlay.style.display === 'none') {
            overlay.style.display = 'block';
            toggleBtn.textContent = 'Hide Heat Map';
            toggleBtn.classList.remove('btn--outline');
            toggleBtn.classList.add('btn--secondary');
            if (this.originalImage) {
                this.compressImage(); // Regenerate heat map
            }
        } else {
            overlay.style.display = 'none';
            toggleBtn.textContent = 'Show Heat Map';
            toggleBtn.classList.remove('btn--secondary');
            toggleBtn.classList.add('btn--outline');
        }
    }

    resetToOriginal() {
        const qualitySlider = document.getElementById('qualitySlider');
        const qualityValue = document.getElementById('qualityValue');
        const maxWidth = document.getElementById('maxWidth');
        const maxHeight = document.getElementById('maxHeight');
        
        if (qualitySlider) qualitySlider.value = 80;
        if (qualityValue) qualityValue.textContent = '80';
        if (maxWidth) maxWidth.value = '';
        if (maxHeight) maxHeight.value = '';
        
        this.currentQuality = 80;
        
        if (this.originalImage) {
            this.compressImage();
        }
    }

    downloadCompressed() {
        if (!this.compressedBlob) {
            this.showError('No compressed image available for download.');
            return;
        }
        
        try {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(this.compressedBlob);
            link.download = `compressed_image_${this.currentQuality}q.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            this.showError('Failed to download image: ' + error.message);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showMainContent() {
        const uploadSection = document.getElementById('uploadSection');
        const mainContent = document.getElementById('mainContent');
        
        if (uploadSection) uploadSection.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'block';
            
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
        
        console.error('Imagify Error:', message);
    }

    hideError() {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new Imagify();
    } catch (error) {
        console.error('Failed to initialize Imagify:', error);
    }
});