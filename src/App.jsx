import * as faceapi from "face-api.js";

import { useEffect, useRef, useState } from "react";

// Company logos
const statsigLogo =
  "https://mintlify.s3.us-west-1.amazonaws.com/coframe/public/logos/statsig.png";

const openaiLogo = "https://cdn.worldvectorlogo.com/logos/openai-2.svg";

// Placeholder people face SVGs TODO: (replace these with actual base64 encoded images or local URLs)
const peopleFaces = [
  await cropCircularRegion("/assets/Vijaye.webp", 690, 300, 500),
  await cropCircularRegion("/assets/Jiakan.png", 250, 250, 500),
  await cropCircularRegion("/assets/Tore.jpeg", 400, 400, 800),
  await cropCircularRegion("/assets/marcos.png", 250, 250, 500),
];

// Helper function to crop a circular region from an image
async function cropCircularRegion(imageSrc, centerX, centerY, diameter = 200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = diameter;
      canvas.height = diameter;
      const ctx = canvas.getContext("2d");

      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(diameter / 2, diameter / 2, diameter / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the image centered on the clicked coordinates
      ctx.drawImage(
        img,
        centerX - diameter / 2, // Source X
        centerY - diameter / 2, // Source Y
        diameter, // Source width
        diameter, // Source height
        0, // Destination X
        0, // Destination Y
        diameter, // Destination width
        diameter // Destination height
      );

      resolve(canvas.toDataURL());
    };
    img.src = imageSrc;
  });
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const headsRef = useRef([]);
  const detectedFacesHistoryRef = useRef([]); // Store history of detected faces

  const [mode, setMode] = useState("company"); // "company" or "people"
  const [companyCount, setCompanyCount] = useState(1); // 1 or 2
  const [peopleCount, setPeopleCount] = useState(0); // 1-n
  const [showHelp, setShowHelp] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const [accessories, setAccessories] = useState([]);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [shouldSaveKey, setShouldSaveKey] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalError, setModalError] = useState("");
  const [accessoryPlacement, setAccessoryPlacement] = useState("hat");

  const modelsLoadedRef = useRef(false);
  const cameraStreamRef = useRef(null);
  const accessoriesRef = useRef([]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedKey = window.localStorage.getItem("openaiApiKey");
    if (storedKey) {
      setApiKey(storedKey);
      setShouldSaveKey(true);
    }
  }, []);

  useEffect(() => {
    accessoriesRef.current = accessories;
  }, [accessories]);

  // Handle keyboard controls
  useEffect(() => {
    function isTypingTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    function handleKeyDown(e) {
      const typingTarget = isTypingTarget(e.target);

      if (isPromptOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (!isGenerating) {
            setIsPromptOpen(false);
            setModalError("");
            setPromptInput("");
          }
        }
        return;
      }

      if (typingTarget) {
        return;
      }

      // Show help on Ctrl or Cmd press
      if (e.key === "Control" || e.key === "Meta") {
        setShowHelp(true);
      }

      if (e.key === "/" || e.key === "?") {
        e.preventDefault();
        setModalError("");
        if (!apiKey) {
          setApiKeyInput("");
        }
        setPromptInput("");
        setIsPromptOpen(true);
        return;
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
          setPeopleCount((prev) => Math.max(prev - 1, 0));
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
  }, [mode, isPromptOpen, isGenerating, apiKey]);

  const handleClosePrompt = () => {
    if (isGenerating) return;
    setIsPromptOpen(false);
    setModalError("");
    setPromptInput("");
  };

  const handleResetApiKey = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("openaiApiKey");
    }
    setApiKey("");
    setApiKeyInput("");
    setShouldSaveKey(false);
    setModalError("");
  };

  const handleApiKeySubmit = (event) => {
    event.preventDefault();
    const trimmedKey = apiKeyInput.trim();

    if (!trimmedKey) {
      setModalError("Please enter a valid OpenAI API key.");
      return;
    }

    if (typeof window !== "undefined") {
      if (shouldSaveKey) {
        window.localStorage.setItem("openaiApiKey", trimmedKey);
      } else {
        window.localStorage.removeItem("openaiApiKey");
      }
    }

    setApiKey(trimmedKey);
    setApiKeyInput("");
    setModalError("");
  };

  const handlePromptSubmit = async (event) => {
    event.preventDefault();

    if (!apiKey) {
      setModalError("Please provide an OpenAI API key first.");
      return;
    }

    const trimmedPrompt = promptInput.trim();
    if (!trimmedPrompt) {
      setModalError("Describe the image you want to generate.");
      return;
    }

    setIsGenerating(true);
    setModalError("");

    const placementInstructions =
      accessoryPlacement === "hat"
        ? "Design a wearable accessory that sits on top of a character's head. Leave generous transparent padding so it can float slightly above a 200px circular face."
        : "Design an accessory that wraps around the lower half of a character's head (collars, scarves, armor, etc.). Keep the middle open so a 200px circular face can peek through.";

    const payload = {
      model: "gpt-image-1",
      prompt: `${trimmedPrompt}\n\nUsage context: This will be rendered as a ${accessoryPlacement} overlay for an animated 200px circular face. ${placementInstructions}\nTechnical constraints: Use a fully transparent background, crisp edges, and keep the subject centred.`,
      size: "1024x1024",
      background: "transparent",
    };

    try {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "OpenAI image generation failed.");
      }

      const data = await response.json();
      const imageBase64 = data?.data?.[0]?.b64_json;

      if (!imageBase64) {
        throw new Error("No image data returned by OpenAI.");
      }

      const imageSrc = `data:image/png;base64,${imageBase64}`;
      const accessoryImage = new Image();
      accessoryImage.src = imageSrc;
      const accessory = {
        id: Math.random(),
        img: accessoryImage,
        placement: accessoryPlacement,
        scale: accessoryPlacement === "hat" ? 0.85 : 1.1,
      };

      setAccessories((prev) => [...prev, accessory]);

      setIsPromptOpen(false);
      setPromptInput("");
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Unable to generate image."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearAccessories = () => {
    if (isGenerating) return;
    setAccessories([]);
    setModalError("");
  };

  const hasAccessories = accessories.length > 0;

  // Initialize heads based on mode
  useEffect(() => {
    if (mode === "company") {
      // Stop camera if running
      stopCamera();

      // Clear detected faces history when switching to company mode
      detectedFacesHistoryRef.current = [];

      // Create company logo heads
      const logos = [statsigLogo, openaiLogo];
      const previousHeads = headsRef.current;

      const presetHeads = logos.slice(0, companyCount).map((logo, i) => {
        const existingHead = previousHeads.find(
          (head) =>
            head?.isPreset &&
            head.presetType === "company" &&
            head.presetIndex === i
        );
        if (existingHead) {
          existingHead.img.src = logo;
          existingHead.presetType = "company";
          existingHead.presetIndex = i;
          return existingHead;
        }
        return spawnHead(logo, null, null, {
          isPreset: true,
          presetType: "company",
          presetIndex: i,
        });
      });

      headsRef.current = [...presetHeads];
    } else {
      // People mode - update only preset faces, preserve detected faces
      const selectedFaces = peopleFaces.slice(0, peopleCount);
      const previousHeads = headsRef.current;
      const retainedHeads = previousHeads.filter((head) => !head?.isPreset);

      const presetHeads = selectedFaces.map((face, i) => {
        const existingHead = previousHeads.find(
          (head) =>
            head?.isPreset &&
            head.presetType === "people" &&
            head.presetIndex === i
        );
        if (existingHead) {
          existingHead.img.src = face;
          existingHead.presetType = "people";
          existingHead.presetIndex = i;
          return existingHead;
        }
        return spawnHead(face, null, null, {
          isPreset: true,
          presetType: "people",
          presetIndex: i,
        });
      });

      headsRef.current = [...presetHeads, ...retainedHeads];

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
            scoreThreshold: 0.2, // Lower threshold to detect more faces
          })
        )
        .withFaceLandmarks();

      const now = Date.now();

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

          return {
            src: canvas.toDataURL(),
            centerX: cx,
            centerY: cy,
          };
        });

        // Match detected faces with history based on proximity
        const history = detectedFacesHistoryRef.current;
        const availableHistoryIds = new Set(history.map((face) => face.id));
        const MATCH_THRESHOLD = 320; // pixels

        newImages.forEach((newImage) => {
          let bestMatch = null;
          let bestDistance = Infinity;

          history.forEach((historyFace) => {
            if (!historyFace || !availableHistoryIds.has(historyFace.id)) {
              return;
            }

            const dx = newImage.centerX - historyFace.centerX;
            const dy = newImage.centerY - historyFace.centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < bestDistance && distance < MATCH_THRESHOLD) {
              bestDistance = distance;
              bestMatch = historyFace;
            }
          });

          if (bestMatch) {
            bestMatch.src = newImage.src;
            bestMatch.centerX = newImage.centerX;
            bestMatch.centerY = newImage.centerY;
            bestMatch.lastSeen = now;
            availableHistoryIds.delete(bestMatch.id);
          } else {
            const newHistoryFace = {
              src: newImage.src,
              centerX: newImage.centerX,
              centerY: newImage.centerY,
              lastSeen: now,
              id:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `face-${Date.now()}-${Math.random()}`,
            };
            history.push(newHistoryFace);
          }
        });
      }

      // Keep faces that were seen recently (within last 60 minutes)
      const PERSISTENCE_TIME = 3600000; // 60 minutes
      detectedFacesHistoryRef.current = detectedFacesHistoryRef.current.filter(
        (face) => now - face.lastSeen < PERSISTENCE_TIME
      );

      // Update headsRef with all faces from history
      const presetFaces = headsRef.current.filter((h) => h?.isPreset);

      const detectedHeads = detectedFacesHistoryRef.current.map(
        (historyFace) => {
          // Try to find existing head with this ID
          const existingHead = headsRef.current.find(
            (h) => !h?.isPreset && h.faceId === historyFace.id
          );

          if (existingHead) {
            // Update image if it changed
            if (existingHead.img.src !== historyFace.src) {
              existingHead.img.src = historyFace.src;
            }
            return existingHead;
          } else {
            // Create new head for this face
            const newHead = spawnHead(historyFace.src, null, null, {
              isPreset: false,
              presetType: "detected",
            });
            newHead.faceId = historyFace.id;
            return newHead;
          }
        }
      );

      headsRef.current = [...presetFaces, ...detectedHeads];
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

          const centreX = x + size / 2;
          const centreY = y + size / 2;

          // Draw head and accessories within the same transform so they share rotation
          ctx.save();
          ctx.translate(centreX, centreY);
          ctx.rotate(head.angle);
          ctx.drawImage(img, -size / 2, -size / 2, size, size);

          accessoriesRef.current.forEach((accessory) => {
            const accessoryImg = accessory?.img;
            if (!accessoryImg || !accessoryImg.complete) return;

            const naturalWidth =
              accessoryImg.naturalWidth || accessoryImg.width;
            const naturalHeight =
              accessoryImg.naturalHeight || accessoryImg.height;
            if (!naturalWidth || !naturalHeight) return;

            const placement = accessory.placement || "hat";
            const baseScale =
              accessory.scale ?? (placement === "hat" ? 0.85 : 1.1);
            const drawWidth = size * baseScale;
            const aspectRatio = naturalHeight / naturalWidth;
            const drawHeight = drawWidth * (aspectRatio || 1);

            const offsetX = -drawWidth / 2;
            const offsetY =
              placement === "collar"
                ? size * 0.1 - drawHeight / 5
                : -size / 2 - drawHeight * 0.65;

            ctx.rotate(head.angle * 0.1);

            ctx.drawImage(
              accessoryImg,
              offsetX,
              offsetY,
              drawWidth,
              drawHeight
            );
          });

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
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          background: "rgba(60, 60, 60, 1)",
        }}
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
            <strong>/</strong> - Open accessory generator
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

      {isPromptOpen && (
        <div
          onClick={isGenerating ? undefined : handleClosePrompt}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: "12px",
              padding: "24px",
              width: "min(420px, 100%)",
              color: "#f5f5f5",
              fontFamily: "monospace",
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "12px",
              }}
            >
              {apiKey ? "Generate an accessory" : "Connect your OpenAI key"}
            </div>

            {modalError && (
              <div
                style={{
                  marginBottom: "12px",
                  color: "#ff6b6b",
                  fontSize: "14px",
                  lineHeight: 1.4,
                }}
              >
                {modalError}
              </div>
            )}

            {apiKey ? (
              <form onSubmit={handlePromptSubmit}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                  }}
                >
                  Accessory placement
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    fontSize: "13px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <input
                      type="radio"
                      name="accessory-placement"
                      value="hat"
                      checked={accessoryPlacement === "hat"}
                      onChange={() => setAccessoryPlacement("hat")}
                    />
                    Hat / headwear (sits above the face)
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <input
                      type="radio"
                      name="accessory-placement"
                      value="collar"
                      checked={accessoryPlacement === "collar"}
                      onChange={() => setAccessoryPlacement("collar")}
                    />
                    Collar / outfit (wraps around the face)
                  </label>
                </div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                  }}
                >
                  Describe the accessory you want to see
                </label>
                <textarea
                  value={promptInput}
                  onChange={(e) => {
                    setPromptInput(e.target.value);
                    setModalError("");
                  }}
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #444",
                    background: "#1a1a1a",
                    color: "#f5f5f5",
                    resize: "vertical",
                    fontFamily: "monospace",
                    marginBottom: "12px",
                  }}
                  placeholder="e.g. Neon party hat with holographic confetti streamers"
                />
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.8,
                    marginBottom: "16px",
                    lineHeight: 1.5,
                  }}
                >
                  Generated art is rendered on top of a 200px circular head. Use
                  a transparent background, centre the design, and leave extra
                  breathing room so it can float above or wrap around the
                  character.
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <button
                    type="submit"
                    disabled={isGenerating}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: isGenerating ? "#555" : "#10A37F",
                      color: "white",
                      cursor: isGenerating ? "default" : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                  {hasAccessories && (
                    <button
                      type="button"
                      onClick={handleClearAccessories}
                      disabled={isGenerating}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "8px",
                        border: "1px solid #444",
                        background: "transparent",
                        color: "#f5f5f5",
                        cursor: isGenerating ? "default" : "pointer",
                      }}
                    >
                      Clear accessories
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetApiKey}
                    disabled={isGenerating}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "1px solid #444",
                      background: "transparent",
                      color: "#f5f5f5",
                      cursor: isGenerating ? "default" : "pointer",
                    }}
                  >
                    Use different API key
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePrompt}
                    disabled={isGenerating}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "1px solid #444",
                      background: "transparent",
                      color: "#f5f5f5",
                      cursor: isGenerating ? "default" : "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleApiKeySubmit}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                  }}
                >
                  OpenAI API key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setModalError("");
                  }}
                  placeholder="sk-..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #444",
                    background: "#1a1a1a",
                    color: "#f5f5f5",
                    marginBottom: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "12px",
                    gap: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={shouldSaveKey}
                    onChange={(e) => setShouldSaveKey(e.target.checked)}
                    style={{ width: "16px", height: "16px" }}
                  />
                  Save this key for future sessions on this device
                </label>
                <div
                  style={{
                    fontSize: "11px",
                    opacity: 0.7,
                    marginTop: "12px",
                    marginBottom: "16px",
                    lineHeight: 1.5,
                  }}
                >
                  OAI Api key will be stored in local storage until user clears
                  browser cache and cookies, or chooses to clear it otherwise.
                  We do not store the key.
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="submit"
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#10A37F",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePrompt}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "1px solid #444",
                      background: "transparent",
                      color: "#f5f5f5",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function spawnHead(src, startX, startY, options = {}) {
  const { isPreset = false, presetType = null, presetIndex = null } = options;
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
    isPreset,
    presetType,
    presetIndex,
  };
}

export default App;
