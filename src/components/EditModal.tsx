import React, { useState, useRef, useEffect } from "react";
import { Crop, Eraser, Wand2, Brush, X, RotateCcw, RotateCw, ZoomIn, ZoomOut, Download } from "lucide-react";

export function EditModal({ imageUrl, onClose }) {
  const [activeTool, setActiveTool] = useState('crop');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cropStart, setCropStart] = useState<{x:number, y:number}|null>(null);
  const [cropEnd, setCropEnd] = useState<{x:number, y:number}|null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (imageUrl) {
      setTimeout(() => initializeCanvas(), 100);
    }
    // eslint-disable-next-line
  }, [imageUrl]);

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
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
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
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
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
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
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
      setCropStart({x: pos.x, y: pos.y});
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
      setCropEnd({x: pos.x, y: pos.y});
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (cropStart && cropEnd) {
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const width = Math.abs(cropEnd.x - cropStart.x);
      const height = Math.abs(cropEnd.y - cropStart.y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(x, y, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    }
  };

  const applyCrop = () => {
    if (!cropStart || !cropEnd) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    const imageData = ctx.getImageData(x, y, width, height);
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      overlayCanvas.width = width;
      overlayCanvas.height = height;
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) overlayCtx.clearRect(0, 0, width, height);
    }
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
        data[index + 3] = 0;
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
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
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
            if (alpha < 128) {
              data[index + 3] = Math.min(255, alpha + (255 - distance * 255 / radius));
            }
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gray-800 rounded-lg w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Görsel Editörü</h2>
          <button
            className="text-white hover:text-gray-300 transition-colors"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-700 bg-gray-700">
          <div className="flex gap-2">
            <button
              className={`p-2 rounded ${activeTool === 'crop' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setActiveTool('crop')}
              title="Kırp"
            >
              <Crop size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'eraser' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setActiveTool('eraser')}
              title="Silgi"
            >
              <Eraser size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'magic_wand' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setActiveTool('magic_wand')}
              title="Sihirli Değnek"
            >
              <Wand2 size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'brush' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setActiveTool('brush')}
              title="Akıllı Fırça"
            >
              <Brush size={20} />
            </button>
          </div>
          <div className="w-px h-8 bg-gray-600 mx-2"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50"
              title="Geri Al"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50"
              title="İleri Al"
            >
              <RotateCw size={20} />
            </button>
          </div>
          <div className="w-px h-8 bg-gray-600 mx-2"></div>
          {(activeTool === 'eraser' || activeTool === 'brush') && (
            <div className="flex items-center gap-2">
              <label className="text-sm">Fırça Boyutu:</label>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm w-8">{brushSize}</span>
            </div>
          )}
          <div className="w-px h-8 bg-gray-600 mx-2"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500"
              title="Uzaklaştır"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500"
              title="Yakınlaştır"
            >
              <ZoomIn size={20} />
            </button>
          </div>
        </div>
        {/* Canvas Area */}
        <div className="flex-1 bg-gray-900 relative overflow-hidden" ref={containerRef}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative" style={{ transform: `scale(${zoom})` }}>
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Düzenlenen görsel"
                className="max-w-none"
                onLoad={initializeCanvas}
                style={{ display: 'none' }}
              />
              <canvas
                ref={canvasRef}
                className="border border-gray-600 cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 pointer-events-none"
              />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {activeTool === 'crop' && "Kırpılacak alanı seçin"}
            {activeTool === 'eraser' && "Silmek istediğiniz alanları boyayın"}
            {activeTool === 'magic_wand' && "Benzer renkteki alanları seçmek için tıklayın"}
            {activeTool === 'brush' && "Geri getirmek istediğiniz alanları boyayın"}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={onClose}
            >
              Vazgeç
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={downloadEditedImage}
            >
              <Download size={18} className="inline mr-1" /> İndir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 