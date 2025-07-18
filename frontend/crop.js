function startCropping(screenshotDataUrl) {
    try {
        // Clean up existing elements more efficiently
        document.querySelectorAll('#overlayCanvas, img[alt="Cropped Screenshot"]').forEach(el => el.remove());

        // Create overlay canvas with better property assignment
        const canvas = document.createElement('canvas');
        canvas.id = 'overlayCanvas';
        Object.assign(canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            zIndex: '999999',
            cursor: 'crosshair',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)' // Semi-transparent overlay
        });
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const img = new Image();

        // Store coordinates more efficiently
        const coords = { startX: 0, startY: 0, endX: 0, endY: 0 };
        let isDragging = false;

        // Improved image loading with error handling
        img.onload = () => {
            try {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Add user guidance
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.fillText('Drag to select area. Release to crop.', 20, 30);
            } catch (e) {
                console.error('Error drawing image:', e);
                handleError('Failed to process screenshot');
            }
        };

        img.onerror = () => handleError('Failed to load screenshot');
        img.src = screenshotDataUrl;

        // Event handlers with better organization
        const handleMouseDown = (e) => {
            coords.startX = e.clientX;
            coords.startY = e.clientY;
            isDragging = true;
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            coords.endX = e.clientX;
            coords.endY = e.clientY;

            // Redraw with selection rectangle
            redrawCanvas();
        };

        const handleMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;

            try {
                // Validate selection size
                const width = Math.abs(coords.endX - coords.startX);
                const height = Math.abs(coords.endY - coords.startY);
                if (width < 10 || height < 10) {
                    throw new Error('Selection too small');
                }

                // Perform crop and send result
                performCrop();
            } catch (e) {
                console.error('Cropping error:', e);
                handleError(e.message);
            } finally {
                canvas.remove();
            }
        };

        // Helper functions
        const redrawCanvas = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Draw selection rectangle
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(
                coords.startX, 
                coords.startY, 
                coords.endX - coords.startX, 
                coords.endY - coords.startY
            );
        };

        const performCrop = () => {
            const cropX = Math.min(coords.startX, coords.endX);
            const cropY = Math.min(coords.startY, coords.endY);
            const cropWidth = Math.abs(coords.endX - coords.startX);
            const cropHeight = Math.abs(coords.endY - coords.startY);

            // Maintain original image size by using natural dimensions
            const scaleX = img.naturalWidth / window.innerWidth;
            const scaleY = img.naturalHeight / window.innerHeight;

            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropWidth;
            croppedCanvas.height = cropHeight;
            const croppedCtx = croppedCanvas.getContext('2d');

            croppedCtx.drawImage(
                img,
                cropX * scaleX,
                cropY * scaleY,
                cropWidth * scaleX,
                cropHeight * scaleY,
                0,
                0,
                cropWidth,
                cropHeight
            );

            const croppedDataUrl = croppedCanvas.toDataURL('image/png');
            sendCroppedImage(croppedDataUrl);
        };

        const sendCroppedImage = (dataUrl) => {
            chrome.runtime.sendMessage({
                action: 'croppedImage',
                dataUrl: dataUrl
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Message failed:', chrome.runtime.lastError);
                }
            });
            chrome.storage.local.set({ lastCroppedImage: dataUrl });
        };

        const handleError = (message) => {
            chrome.runtime.sendMessage({
                action: 'croppingError',
                error: message
            });
            canvas.remove();
        };

        // Add event listeners
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);

    } catch (e) {
        console.error('Initialization error:', e);
        chrome.runtime.sendMessage({
            action: 'croppingError',
            error: 'Failed to initialize cropping tool'
        });
    }
}

// Message listener remains the same
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startCropping') {
        startCropping(request.screenshot);
    }
});