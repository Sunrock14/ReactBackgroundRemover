import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";
import { Crop, Eraser, Wand2, Brush, Download, Copy, X, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import "onnxruntime-web";
import { EditModal } from "./components/EditModal";

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r
  }, '');
}

export default function App() {
  const [images, setImages] = useState<{name: string, fileUrl: string, processedUrl: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editImage, setEditImage] = useState(null);
  
  // Editor state
  const [activeTool, setActiveTool] = useState('crop');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const modelRef = useRef(null);
  const processorRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Cookie'den yükle
  useEffect(() => {
    (async () => {
      try {
        if (!navigator.gpu) {
          throw new Error("WebGPU bu tarayıcıda desteklenmiyor.");
        }
        const model_id = "Xenova/modnet";
        env.backends.onnx.wasm.proxy = false;
        modelRef.current ??= await AutoModel.from_pretrained(model_id, {
          device: "webgpu",
        });
        processorRef.current ??= await AutoProcessor.from_pretrained(model_id);
        
        const cookieData = getCookie("bg_images");
        if (cookieData) {
          try {
            const parsed = JSON.parse(cookieData);
            if (Array.isArray(parsed) && parsed.every(img => typeof img.name === 'string' && typeof img.fileUrl === 'string' && typeof img.processedUrl === 'string')) {
              setImages(parsed);
            }
          } catch {}
        }
      } catch (err) {
        setError(err);
      }
      setIsLoading(false);
    })();
  }, []);

  // Cookie'ye kaydet
  useEffect(() => {
    setCookie("bg_images", JSON.stringify(images), 7);
  }, [images]);

  // Görsel işleme fonksiyonu
  const processImage = async (file) => {
    const img = await RawImage.fromURL(URL.createObjectURL(file));
    if (!processorRef.current) throw new Error("İşleyici yüklenemedi.");
    const { pixel_values } = await processorRef.current(img);
    if (!modelRef.current) throw new Error("Model yüklenemedi.");
    const { output } = await modelRef.current({ input: pixel_values });
    const maskData = (
      await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
        img.width,
        img.height,
      )
    ).data;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context alınamadı.");
    ctx.drawImage(img.toCanvas(), 0, 0);
    const pixelData = ctx.getImageData(0, 0, img.width, img.height);
    for (let i = 0; i < maskData.length; ++i) {
      pixelData.data[4 * i + 3] = maskData[i];
    }
    ctx.putImageData(pixelData, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject();
        }
      }, "image/png")
    );
  };

  const MAX_IMAGES = 20;
  const onDrop = useCallback(async (acceptedFiles) => {
    let newImages = [...images];
    for (const file of acceptedFiles) {
      if (newImages.length >= MAX_IMAGES) {
        newImages.pop();
      }
      const processedUrl = await processImage(file);
      newImages = [
        {
          name: file.name,
          fileUrl: URL.createObjectURL(file),
          processedUrl: processedUrl,
        },
        ...newImages
      ];
    }
    setImages(newImages);
  }, [images]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

  // Editor functions
  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(canvas.toDataURL());
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevImage = history[historyIndex - 1];
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = prevImage;
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextImage = history[historyIndex + 1];
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = nextImage;
      setHistoryIndex(historyIndex + 1);
    }
  };

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const img = imageRef.current;
    
    if (!canvas || !overlayCanvas || !img) return;
    
    // Ana canvas'ı ayarla
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Overlay canvas'ı ayarla
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
    
    // İlk durumu history'ye kaydet
    const initialHistory = [canvas.toDataURL()];
    setHistory(initialHistory);
    setHistoryIndex(0);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    
    if (activeTool === 'crop') {
      setCropStart(pos);
      setIsCropping(true);
    } else if (activeTool === 'eraser' || activeTool === 'brush') {
      setIsDrawing(true);
      drawBrush(pos);
    } else if (activeTool === 'magic_wand') {
      magicWandSelect(pos);
    }
  };

  const handleMouseMove = (e) => {
    const pos = getMousePos(e);
    
    if (activeTool === 'crop' && isCropping) {
      setCropEnd(pos);
      drawCropOverlay();
    } else if ((activeTool === 'eraser' || activeTool === 'brush') && isDrawing) {
      drawBrush(pos);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'crop' && isCropping) {
      setIsCropping(false);
      if (cropStart && cropEnd) {
        applyCrop();
      }
    } else if (activeTool === 'eraser' || activeTool === 'brush') {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const drawBrush = (pos) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    
    if (activeTool === 'brush') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    }
    
    ctx.fill();
  };

  const drawCropOverlay = () => {
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = overlayCanvas.getContext('2d');
    
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (cropStart && cropEnd) {
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const width = Math.abs(cropEnd.x - cropStart.x);
      const height = Math.abs(cropEnd.y - cropStart.y);
      
      // Karartma efekti
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      
      // Seçili alan
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(x, y, width, height);
      
      // Kenarlık
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }
  };

  const applyCrop = () => {
    if (!cropStart || !cropEnd) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    
    const imageData = ctx.getImageData(x, y, width, height);
    
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
    
    // Overlay'i temizle
    const overlayCanvas = overlayCanvasRef.current;
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    overlayCanvas.getContext('2d').clearRect(0, 0, width, height);
    
    setCropStart(null);
    setCropEnd(null);
    saveToHistory();
  };

  const magicWandSelect = async (pos) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const tolerance = 10;
    const startIndex = (pos.y * canvas.width + pos.x) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];
    
    const stack = [{ x: Math.floor(pos.x), y: Math.floor(pos.y) }];
    const visited = new Set();
    
    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        continue;
      }
      
      visited.add(key);
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];
      
      const diff = Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB) + Math.abs(a - startA);
      
      if (diff <= tolerance) {
        // Pikseli şeffaf yap
        data[index + 3] = 0;
        
        // Komşu pikselleri ekle
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
  };

  const smartBrush = (pos) => {
    // Akıllı fırça - kenar algılama ile otomatik boyama
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Basit kenar algılama ve otomatik boyama
    const radius = brushSize;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          const x = Math.floor(pos.x + dx);
          const y = Math.floor(pos.y + dy);
          
          if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const index = (y * canvas.width + x) * 4;
            const alpha = data[index + 3];
            
            // Kenar algılama - alfa değeri düşükse (şeffaf alanlarda) boyama yap
            if (alpha < 128) {
              data[index + 3] = Math.min(255, alpha + (255 - distance * 255 / radius));
            }
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  const clearAll = () => {
    setImages([]);
  };

  const copyToClipboard = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const clipboardItem = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([clipboardItem]);
    } catch (err) {
      alert("Kopyalama başarısız!");
    }
  };

  const downloadImage = (url, name) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name || "gorsel.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadEditedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement("a");
    link.href = canvas.toDataURL();
    link.download = "duzenlenmis-gorsel.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEditor = (imageUrl) => {
    setEditImage(imageUrl);
    setEditModalOpen(true);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl mb-2">HATA</h2>
          <p className="text-xl max-w-[500px]">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-4"></div>
          <p className="text-lg">Arkaplan kaldırma modeli yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-8 bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div
          {...getRootProps()}
          className={`p-8 mb-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-300 ease-in-out
            ${isDragAccept ? "border-green-500 bg-gray-800/60" : ""}
            ${isDragReject ? "border-red-500 bg-red-900/20" : ""}
            ${isDragActive ? "border-blue-500 bg-gray-700/80" : "border-gray-700 hover:border-blue-500 hover:bg-gray-800/40"}
          `}
        >
          <input {...getInputProps()} className="hidden" />
          <p className="text-lg mb-2">
            {isDragActive
              ? "Görselleri buraya bırakın..."
              : "Görselleri buraya sürükleyip bırakın"}
          </p>
          <p className="text-sm text-gray-400">veya tıklayarak seçin (en fazla 20)</p>
        </div>

        <div className="flex flex-col items-center gap-4 mb-8">
          <button
            onClick={clearAll}
            className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black transition-colors duration-200 text-sm"
          >
            Tümünü Temizle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img, index) => (
            <div key={index} className="relative group bg-gray-800 rounded-lg p-2">
              <img
                src={img.processedUrl}
                alt={`Görsel ${index + 1}`}
                className="rounded-lg object-cover w-full h-48 border border-gray-700"
              />
              <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center gap-2">
                <button
                  onClick={() => copyToClipboard(img.processedUrl)}
                  className="p-2 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200"
                  title="Kopyala"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => downloadImage(img.processedUrl, img.name.replace(/\.[^/.]+$/, "") + "-arkaplan-kaldirildi.png")}
                  className="p-2 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200"
                  title="İndir"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => openEditor(img.processedUrl)}
                  className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200"
                  title="Düzenle"
                >
                  <Brush size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editModalOpen && (
          <EditModal
            imageUrl={editImage}
            onClose={() => setEditModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}