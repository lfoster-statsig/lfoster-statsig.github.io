import * as faceapi from "face-api.js";

import { useEffect, useRef, useState } from "react";

// Company logos as SVG data URIs
const statsigLogo =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23194B7D' rx='20'/><path d='M60 140 L60 110 Q60 90 80 90 L120 90 Q140 90 140 70 Q140 50 120 50 L60 50' stroke='white' stroke-width='12' fill='none' stroke-linecap='round'/><path d='M60 150 L140 150' stroke='white' stroke-width='12' stroke-linecap='round'/></svg>";

const openaiLogo =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%2310A37F' rx='20'/><circle cx='100' cy='100' r='60' fill='none' stroke='white' stroke-width='10'/><circle cx='100' cy='100' r='15' fill='white'/><path d='M100 55 L100 85' stroke='white' stroke-width='10' stroke-linecap='round'/><path d='M100 115 L100 145' stroke='white' stroke-width='10' stroke-linecap='round'/><path d='M145 100 L115 100' stroke='white' stroke-width='10' stroke-linecap='round'/><path d='M85 100 L55 100' stroke='white' stroke-width='10' stroke-linecap='round'/></svg>";

// Placeholder people face SVGs (replace these with actual base64 encoded images or local URLs)
const peopleFaces = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><circle cx='100' cy='100' r='100' fill='%23FFD700'/><circle cx='75' cy='85' r='12' fill='%23000'/><circle cx='125' cy='85' r='12' fill='%23000'/><ellipse cx='100' cy='130' rx='30' ry='20' fill='%23FF6B6B'/><path d='M70 120 Q100 140 130 120' stroke='%23000' stroke-width='3' fill='none'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><circle cx='100' cy='100' r='100' fill='%2387CEEB'/><circle cx='75' cy='85' r='12' fill='%23000'/><circle cx='125' cy='85' r='12' fill='%23000'/><ellipse cx='100' cy='130' rx='30' ry='20' fill='%23FFB6C1'/><path d='M70 120 Q100 140 130 120' stroke='%23000' stroke-width='3' fill='none'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><circle cx='100' cy='100' r='100' fill='%2398D8C8'/><circle cx='75' cy='85' r='12' fill='%23000'/><circle cx='125' cy='85' r='12' fill='%23000'/><ellipse cx='100' cy='130' rx='30' ry='20' fill='%23F7B7A3'/><path d='M70 120 Q100 140 130 120' stroke='%23000' stroke-width='3' fill='none'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><circle cx='100' cy='100' r='100' fill='%23DDA0DD'/><circle cx='75' cy='85' r='12' fill='%23000'/><circle cx='125' cy='85' r='12' fill='%23000'/><ellipse cx='100' cy='130' rx='30' ry='20' fill='%23FFA07A'/><path d='M70 120 Q100 140 130 120' stroke='%23000' stroke-width='3' fill='none'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><circle cx='100' cy='100' r='100' fill='%23FFFFFF'/><circle cx='75' cy='85' r='12' fill='%23000'/><circle cx='125' cy='85' r='12' fill='%23000'/><ellipse cx='100' cy='130' rx='30' ry='20' fill='%23FF6B6B'/><path d='M70 120 Q100 140 130 120' stroke='%23000' stroke-width='3' fill='none'/></svg>",
];

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const headsRef = useRef([]);

  const [mode, setMode] = useState("company"); // "company" or "people"
  const [companyCount, setCompanyCount] = useState(1); // 1 or 2
  const [peopleCount, setPeopleCount] = useState(1); // 1-n
  const [showHelp, setShowHelp] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const modelsLoadedRef = useRef(false);
  const cameraStreamRef = useRef(null);

  // Load models (but don't start camera yet)
  useEffect(() => {
    async function loadModels() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("./models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
        modelsLoadedRef.current = true;
      } catch (err) {
        console.warn("Models failed to load:", err);
      }
    }
    loadModels();
  }, []);

  // Handle keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      // Show help on Ctrl or Cmd
      if (e.key === "Control" || e.key === "Meta") {
        setShowHelp(true);
      }

      if (e.key === "]") {
        if (mode === "company") {
          setCompanyCount((prev) => Math.min(prev + 1, 2));
        } else {
          setPeopleCount((prev) => Math.min(prev + 1, peopleFaces.length));
        }
      } else if (e.key === "[") {
        if (mode === "company") {
          setCompanyCount((prev) => Math.max(prev - 1, 1));
        } else {
          setPeopleCount((prev) => Math.max(prev - 1, 1));
        }
      } else if (e.key === "p" || e.key === "P") {
        setMode("people");
      } else if (e.key === "c" || e.key === "C") {
        setMode("company");
      } else if (e.key === "t" || e.key === "T") {
        setCameraEnabled((prev) => !prev);
      }
    }

    function handleKeyUp(e) {
      // Hide help on Ctrl or Cmd release
      if (e.key === "Control" || e.key === "Meta") {
        setShowHelp(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode]);

  // Initialize heads based on mode
  useEffect(() => {
    if (mode === "company") {
      // Stop camera if running
      stopCamera();

      // Create company logo heads
      const logos = [statsigLogo, openaiLogo];
      headsRef.current = logos.slice(0, companyCount).map((logo, i) => {
        const existingHead = headsRef.current[i];
        if (existingHead && existingHead.isPreset) {
          existingHead.img.src = logo;
          return existingHead;
        }
        return spawnHead(logo, null, null, true);
      });
    } else {
      // People mode - update only preset faces, preserve detected faces
      const selectedFaces = peopleFaces.slice(0, peopleCount);
      const detectedFaces = headsRef.current.filter((h) => !h.isPreset);

      const presetHeads = selectedFaces.map((face, i) => {
        const existingHead = headsRef.current.find(
          (h, idx) => h.isPreset && idx === i
        );
        if (existingHead) {
          existingHead.img.src = face;
          return existingHead;
        }
        return spawnHead(face, null, null, true);
      });

      headsRef.current = [...presetHeads, ...detectedFaces];

      // Start camera if enabled
      if (cameraEnabled) {
        startCamera();
      }
    }
  }, [mode, companyCount, peopleCount, cameraEnabled]);

  // Start camera
  async function startCamera() {
    if (!modelsLoadedRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.warn("Camera denied or error:", err);
    }
  }

  // Stop camera
  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // Face detection loop (only in people mode with camera enabled)
  useEffect(() => {
    if (mode !== "people" || !cameraEnabled) return;

    let interval;

    async function detect() {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;

      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.05, // Lower threshold to detect more faces
          })
        )
        .withFaceLandmarks();

      if (detections && detections.length > 0) {
        const newImages = detections.map((detection) => {
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

        // Keep the preset faces
        const presetFaces = headsRef.current.filter((h) => h.isPreset);
        const existingDetectedFaces = headsRef.current.filter(
          (h) => !h.isPreset
        );

        const detectedHeads = newImages.map((src, i) => {
          // Try to reuse existing detected face at this index
          if (existingDetectedFaces[i]) {
            existingDetectedFaces[i].img.src = src;
            return existingDetectedFaces[i];
          }
          // Create new detected face if we need more
          return spawnHead(src, null, null, false);
        });

        headsRef.current = [...presetFaces, ...detectedHeads];
      } else {
        // No faces detected, keep only preset faces
        headsRef.current = headsRef.current.filter((h) => h.isPreset);
      }
    }

    interval = setInterval(detect, 500);
    return () => clearInterval(interval);
  }, [mode, cameraEnabled]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      headsRef.current.forEach((head) => {
        if (!head) return;

        const { x, y, dx, dy, size } = head;
        const img = head.img;

        if (img && img.complete) {
          // Update rotation angle
          const speed = Math.sqrt(dx * dx + dy * dy);
          const direction = dx >= 0 ? 1 : -1;
          head.angle = (head.angle || 0) + direction * (speed * 0.001);

          // Draw with rotation
          ctx.save();
          ctx.translate(x + size / 2, y + size / 2);
          ctx.rotate(head.angle);
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
          ctx.restore();
        }

        // Update position
        head.x += head.dx;
        head.y += head.dy;

        // Bounce on edges
        if (head.x <= 0 || head.x + size >= canvas.width) {
          head.dx *= -1;
          head.x = Math.max(0, Math.min(head.x, canvas.width - size));
        }
        if (head.y <= 0 || head.y + size >= canvas.height) {
          head.dy *= -1;
          head.y = Math.max(0, Math.min(head.y, canvas.height - size));
        }
      });

      // Handle collisions between all pairs
      for (let i = 0; i < headsRef.current.length; i++) {
        for (let j = i + 1; j < headsRef.current.length; j++) {
          const h1 = headsRef.current[i];
          const h2 = headsRef.current[j];
          if (!h1 || !h2) continue;

          // Calculate centers
          const h1CenterX = h1.x + h1.size / 2;
          const h1CenterY = h1.y + h1.size / 2;
          const h2CenterX = h2.x + h2.size / 2;
          const h2CenterY = h2.y + h2.size / 2;

          // Calculate distance between centers
          const dx = h2CenterX - h1CenterX;
          const dy = h2CenterY - h1CenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Sum of radii
          const radiusSum = h1.size / 2 + h2.size / 2;

          // Check if circles are colliding (distance <= sum of radii)
          if (distance <= radiusSum && distance > 0) {
            // Normalize the collision vector
            const nx = dx / distance;
            const ny = dy / distance;

            // Calculate relative velocity
            const dvx = h1.dx - h2.dx;
            const dvy = h1.dy - h2.dy;

            // Calculate relative velocity along collision normal
            const relativeVelocity = dvx * nx + dvy * ny;

            // Only bounce if objects are moving toward each other
            if (relativeVelocity > 0) {
              // For elastic collision with equal mass, swap velocity components
              // along the collision normal
              h1.dx -= relativeVelocity * nx;
              h1.dy -= relativeVelocity * ny;
              h2.dx += relativeVelocity * nx;
              h2.dy += relativeVelocity * ny;

              // Separate the circles to prevent overlap
              const overlap = radiusSum - distance;
              const separationX = (overlap / 2) * nx;
              const separationY = (overlap / 2) * ny;

              h1.x -= separationX;
              h1.y -= separationY;
              h2.x += separationX;
              h2.y += separationY;
            }
          }
        }
      }

      requestAnimationFrame(animate);
    }

    animate();
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ position: "absolute", top: 0, left: 0, background: "#000" }}
      />

      {/* Help popup - only shows when Ctrl/Cmd is held */}
      {showHelp && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            fontFamily: "monospace",
            fontSize: "16px",
            background: "rgba(0,0,0,0.9)",
            padding: "30px",
            borderRadius: "10px",
            zIndex: 1000,
            border: "2px solid white",
            minWidth: "300px",
          }}
        >
          <div
            style={{
              marginBottom: "20px",
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
            Controls
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong>P</strong> - Switch to People mode
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong>C</strong> - Switch to Company mode
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong>T</strong> - Toggle camera {cameraEnabled ? "OFF" : "ON"}
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong>[</strong> - Decrease count
          </div>
          <div style={{ marginBottom: "10px" }}>
            <strong>]</strong> - Increase count
          </div>
          <div style={{ marginTop: "20px", fontSize: "12px", opacity: 0.7 }}>
            Current mode:{" "}
            {mode === "company"
              ? `Company (${companyCount}/2)`
              : `People (${peopleCount}/${peopleFaces.length})`}
            {mode === "people" && (
              <div>Camera: {cameraEnabled ? "ON" : "OFF"}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function spawnHead(src, startX, startY, isPreset = false) {
  const img = new Image();
  img.src = src;
  return {
    img,
    x: startX ?? Math.random() * (window.innerWidth - 120),
    y: startY ?? Math.random() * (window.innerHeight - 120),
    dx: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.5),
    dy: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.5),
    size: 120,
    angle: 0,
    isPreset: isPreset, // Flag to distinguish preset faces from detected faces
  };
}

export default App;
