function startCropping(screenshotDataUrl) {

  const existingCanvas = document.getElementById("overlayCanvas");
  if (existingCanvas) existingCanvas.remove();
  const existingImage = document.querySelector("img[alt='Cropped Screenshot']");
  if (existingImage) existingImage.remove();

  // Create overlay canvas
  const canvas = document.createElement("canvas");
  canvas.id = "overlayCanvas";
  canvas.style.position = "fixed";
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.zIndex = 999999;
  canvas.style.cursor = "crosshair";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = screenshotDataUrl;

  let startX, startY, endX, endY;
  let isDragging = false;

  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  canvas.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    endX = e.clientX;
    endY = e.clientY;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;

    const cropX = Math.min(startX, endX);
    const cropY = Math.min(startY, endY);
    const cropWidth = Math.abs(endX - startX);
    const cropHeight = Math.abs(endY - startY);

    const scaleX = img.width / window.innerWidth;
    const scaleY = img.height / window.innerHeight;

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext("2d");

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

    const croppedImg = new Image();
    croppedImg.src = croppedCanvas.toDataURL("image/png");
    croppedImg.style.position = "fixed";
    croppedImg.style.top = "10px";
    croppedImg.style.right = "10px";
    croppedImg.style.maxWidth = "300px";
    croppedImg.style.border = "2px solid black";
    croppedImg.style.zIndex = 1000000;

    document.body.appendChild(croppedImg);
    canvas.remove(); 

    chrome.runtime.sendMessage({
      action: "croppedImage",
      dataUrl: croppedImg.src
    })
    
  });
}

// Listen for message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startCropping") {
    startCropping(request.screenshot);
  }
});