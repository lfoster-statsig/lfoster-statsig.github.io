import { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import "./App.css";

const defaultSvg =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><circle cx='60' cy='60' r='50' fill='orange' stroke='black' stroke-width='4'/><circle cx='45' cy='50' r='8' fill='black'/><circle cx='75' cy='50' r='8' fill='black'/><path d='M40 80 Q60 100 80 80' stroke='black' stroke-width='4' fill='transparent'/></svg>";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Store bouncing heads here
  const headsRef = useRef([]);

  // Load models + camera
  useEffect(() => {
    async function setup() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.warn("Camera denied or error:", err);
        // fallback → one bouncing default head
        headsRef.current = [
          spawnHead(defaultSvg, window.innerWidth / 2, window.innerHeight / 2),
        ];
      }
    }
    setup();
  }, []);

  // Face detection loop
  useEffect(() => {
    let interval;

    async function detect() {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        )
        .withFaceLandmarks();

      let newImages;
      if (detections && detections.length > 0) {
        newImages = detections.map((detection) => {
          const { x, y, width, height } = detection.detection.box;
          const cx = x + width / 2;
          const cy = y + height / 2;

          const targetSize = 200;
          const scaleFactor = 2.0;

          const cropWidth = width * scaleFactor;
          const cropHeight = height * scaleFactor * 1.2;
          const cropX = cx - cropWidth / 2;
          const cropY = cy - cropHeight / 2;

          const canvas = document.createElement("canvas");
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext("2d");

          ctx.beginPath();
          ctx.ellipse(
            targetSize / 2,
            targetSize / 2,
            targetSize / 2,
            targetSize / 2,
            0,
            0,
            2 * Math.PI
          );
          ctx.closePath();
          ctx.clip();

          ctx.drawImage(
            videoRef.current,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            targetSize,
            targetSize
          );

          return canvas.toDataURL();
        });
      } else {
        newImages = [defaultSvg];
      }

      // Update headsRef: keep positions if already exist
      newImages.forEach((src, i) => {
        if (headsRef.current[i]) {
          headsRef.current[i].img.src = src;
        } else {
          // Spawn new head if more detected than before
          headsRef.current[i] = spawnHead(src);
        }
      });

      // If fewer detections than before → trim array
      headsRef.current = headsRef.current.slice(0, newImages.length);
    }

    interval = setInterval(detect, 500);
    return () => clearInterval(interval);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      headsRef.current.forEach((head) => {
        const { img, size } = head;

        if (img.complete) {
          ctx.drawImage(img, head.x, head.y, size, size);
        }

        // Move
        head.x += head.dx;
        head.y += head.dy;

        // Bounce
        if (head.x <= 0 || head.x + size >= canvas.width) head.dx *= -1;
        if (head.y <= 0 || head.y + size >= canvas.height) head.dy *= -1;
      });

      requestAnimationFrame(animate);
    }

    animate();
  }, []);

  return (
    <>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
    </>
  );
}

// Utility: create a new bouncing head
function spawnHead(src, startX, startY) {
  const img = new Image();
  img.src = src;
  return {
    img,
    x: startX ?? Math.random() * (window.innerWidth - 120),
    y: startY ?? Math.random() * (window.innerHeight - 120),
    dx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2),
    dy: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2),
    size: 120,
  };
}

export default App;
