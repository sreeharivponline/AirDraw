// Global references
const videoElement = document.getElementById('input_video');
const outputCanvas = document.getElementById('output_canvas');
const outputCtx = outputCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawing_canvas');
const drawingCtx = drawingCanvas.getContext('2d');
const loadingOverlay = document.getElementById('loading');

// State
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#00ffcc';
const strokeWidth = 5;
const PINCH_THRESHOLD = 0.05; // Distance between thumb and index to trigger pinch

// Set up resize handling
function resizeCanvas() {
  const container = document.querySelector('.video-container');
  const rect = container.getBoundingClientRect();
  
  // High DPI support
  const dpr = window.devicePixelRatio || 1;
  
  [outputCanvas, drawingCanvas].forEach(canvas => {
    // Only resize if different to avoid clearing canvas
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      if (canvas === drawingCanvas) {
        // Save current drawing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = drawingCanvas.width;
        tempCanvas.height = drawingCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(drawingCanvas, 0, 0);
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Restore drawing
        drawingCtx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      } else {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    }
  });
}

window.addEventListener('resize', resizeCanvas);
// Call once initially, but we might need to call again when video starts
setTimeout(resizeCanvas, 100);

// Colors setup
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentColor = e.target.dataset.color;
    drawingCanvas.style.color = currentColor; // For the drop-shadow
  });
});
drawingCanvas.style.color = currentColor;

// Clear button
document.getElementById('clear-btn').addEventListener('click', () => {
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
});

// Helper: Calculate distance between two landmarks
function getDistance(lm1, lm2) {
  return Math.sqrt(
    Math.pow(lm1.x - lm2.x, 2) + 
    Math.pow(lm1.y - lm2.y, 2) + 
    Math.pow(lm1.z - lm2.z, 2)
  );
}

// MediaPipe Hands setup
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults((results) => {
  // Hide loading on first result
  if (!document.body.classList.contains('loaded')) {
    document.body.classList.add('loaded');
    resizeCanvas(); // Ensure canvas is right size now that video is streaming
  }

  // Draw camera feed and landmarks
  outputCtx.save();
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  
  const rect = outputCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  // Draw the video frame
  outputCtx.drawImage(results.image, 0, 0, width, height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    // Draw landmarks
    drawConnectors(outputCtx, landmarks, HAND_CONNECTIONS, {
      color: 'rgba(255, 255, 255, 0.2)', 
      lineWidth: 2
    });
    drawLandmarks(outputCtx, landmarks, {
      color: 'rgba(0, 255, 204, 0.5)', 
      lineWidth: 1, 
      radius: 3
    });

    // Interaction logic
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    // Check for pinch (thumb and index close to each other)
    const pinchDist = getDistance(thumbTip, indexTip);
    const isPinching = pinchDist < PINCH_THRESHOLD;

    // Calculate actual coordinates for drawing
    // Note: x is inverted because we flip the canvas in CSS to act as a mirror!
    // But actually, the drawing logic needs to match the canvas coordinate system.
    // Since canvas is flipped via CSS `transform: scaleX(-1)`, we should just draw at the raw coordinates!
    // Wait, if MediaPipe returns x=0 for left edge of image, and image is drawn on canvas, 
    // the canvas will display it flipped. So we draw exactly where MediaPipe says.
    const drawX = indexTip.x * width;
    const drawY = indexTip.y * height;

    // Draw an indicator at the index finger tip
    outputCtx.beginPath();
    outputCtx.arc(drawX, drawY, isPinching ? 8 : 5, 0, 2 * Math.PI);
    outputCtx.fillStyle = isPinching ? currentColor : 'white';
    outputCtx.fill();
    
    // Outer ring for pinch indicator
    if (!isPinching) {
      outputCtx.beginPath();
      outputCtx.arc(drawX, drawY, Math.max(5, (PINCH_THRESHOLD - pinchDist)*300), 0, 2 * Math.PI);
      outputCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      outputCtx.stroke();
    }

    if (isPinching) {
      if (!isDrawing) {
        isDrawing = true;
        lastX = drawX;
        lastY = drawY;
      } else {
        // Draw a line
        drawingCtx.beginPath();
        drawingCtx.moveTo(lastX, lastY);
        drawingCtx.lineTo(drawX, drawY);
        drawingCtx.strokeStyle = currentColor;
        drawingCtx.lineWidth = strokeWidth;
        drawingCtx.lineCap = 'round';
        drawingCtx.lineJoin = 'round';
        drawingCtx.stroke();
        
        lastX = drawX;
        lastY = drawY;
      }
    } else {
      isDrawing = false;
    }
  } else {
    isDrawing = false;
  }
  
  outputCtx.restore();
});

// Setup Camera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});

// Start camera
camera.start().catch(err => {
  console.error("Camera access error:", err);
  alert("Could not access camera. Please ensure you have granted camera permissions.");
  loadingOverlay.querySelector('p').innerText = "Camera Error: " + err.message;
  loadingOverlay.querySelector('.spinner').style.display = 'none';
});
