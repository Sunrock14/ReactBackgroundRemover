import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Crop, Eraser, Wand2, Brush, X, RotateCcw, RotateCw, ZoomIn, ZoomOut, Download, Move, Square, 
  Smartphone, Monitor, Film, FlipHorizontal, FlipVertical, RotateCw as Rotate90, Palette, 
  Sun, Moon, Contrast, Droplets, Zap, Eye, Sparkles, Image as ImageIcon
} from "lucide-react";

export default function EditModal({ imageUrl, onClose }) {
  const [activeTool, setActiveTool] = useState('crop');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cropSelection, setCropSelection] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [cropRatio, setCropRatio] = useState('free');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);
  const [tolerance, setTolerance] = useState(10);
  const [brushColor, setBrushColor] = useState('#ffffff');
  
  // Yeni filter durumları
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0,
    grayscale: 0,
    invert: 0,
    opacity: 100
  });
  const [showFilters, setShowFilters] = useState(false);
  const [rotation, setRotation] = useState(0);

  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const originalImageData = useRef(null);

  const cropRatios = {
    'free': { label: 'Serbest', ratio: null, icon: Crop },
    '1:1': { label: '1:1 (Kare)', ratio: 1, icon: Square },
    '16:9': { label: '16:9 (Geniş)', ratio: 16/9, icon: Monitor },
    '9:16': { label: '9:16 (Dikey)', ratio: 9/16, icon: Smartphone },
    '4:3': { label: '4:3 (Klasik)', ratio: 4/3, icon: Film },
    '3:4': { label: '3:4 (Portre)', ratio: 3/4, icon: Film }
  };

  const filterPresets = {
    normal: { name: 'Normal', brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0 },
    vintage: { name: 'Vintage', brightness: 110, contrast: 85, saturation: 80, hue: 20, blur: 0, sepia: 40, grayscale: 0, invert: 0 },
    bw: { name: 'Siyah Beyaz', brightness: 100, contrast: 110, saturation: 0, hue: 0, blur: 0, sepia: 0, grayscale: 100, invert: 0 },
    warm: { name: 'Sıcak', brightness: 105, contrast: 95, saturation: 120, hue: 15, blur: 0, sepia: 20, grayscale: 0, invert: 0 },
    cool: { name: 'Soğuk', brightness: 95, contrast: 105, saturation: 110, hue: -10, blur: 0, sepia: 0, grayscale: 0, invert: 0 },
    dramatic: { name: 'Dramatik', brightness: 90, contrast: 140, saturation: 130, hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0 },
    soft: { name: 'Yumuşak', brightness: 115, contrast: 80, saturation: 90, hue: 5, blur: 1, sepia: 10, grayscale: 0, invert: 0 },
    high_contrast: { name: 'Yüksek Kontrast', brightness: 100, contrast: 180, saturation: 120, hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0 }
  };

  useEffect(() => {
    if (imageUrl) {
      setTimeout(() => initializeCanvas(), 100);
    }
  }, [imageUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && activeTool === 'crop' && cropSelection) {
        applyCrop();
      }
      if (e.key === 'Escape' && activeTool === 'crop') {
        setCropSelection(null);
        clearOverlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, cropSelection]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.max(0.1, Math.min(5, prev + zoomDelta)));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Filtreleri uygula
  useEffect(() => {
    applyFilters();
  }, [filters, rotation]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(canvas.toDataURL());
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

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
    const cursorCanvas = cursorCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !overlayCanvas || !cursorCanvas || !img) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
    cursorCanvas.width = img.naturalWidth;
    cursorCanvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    // Orijinal görsel verisini sakla
    originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const initialHistory = [canvas.toDataURL()];
    setHistory(initialHistory);
    setHistoryIndex(0);
  };

  const applyFilters = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImageData.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Rotasyonu uygula
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // Canvas filtresini uygula
    const filterString = `
      brightness(${filters.brightness}%) 
      contrast(${filters.contrast}%) 
      saturate(${filters.saturation}%) 
      hue-rotate(${filters.hue}deg) 
      blur(${filters.blur}px) 
      sepia(${filters.sepia}%) 
      grayscale(${filters.grayscale}%) 
      invert(${filters.invert}%) 
      opacity(${filters.opacity}%)
    `.replace(/\s+/g, ' ').trim();

    ctx.filter = filterString;
    ctx.putImageData(originalImageData.current, 0, 0);
    ctx.filter = 'none';

    if (rotation !== 0) {
      ctx.restore();
    }
  };

  const resetFilters = () => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      invert: 0,
      opacity: 100
    });
    setRotation(0);
  };

  const applyFilterPreset = (preset) => {
    setFilters(filterPresets[preset]);
  };

  const flipHorizontal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, -canvas.width, 0);
    ctx.restore();

    originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const flipVertical = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(1, -1);
    ctx.drawImage(canvas, 0, -canvas.height);
    ctx.restore();

    originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const rotateImage = (degrees) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    if (degrees === 90 || degrees === -90) {
      // 90 derece döndürme için canvas boyutlarını değiştir
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.height;
      tempCanvas.height = canvas.width;
      
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate((degrees * Math.PI) / 180);
      tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      
      canvas.width = tempCanvas.width;
      canvas.height = tempCanvas.height;
      
      const overlayCanvas = overlayCanvasRef.current;
      const cursorCanvas = cursorCanvasRef.current;
      if (overlayCanvas) {
        overlayCanvas.width = canvas.width;
        overlayCanvas.height = canvas.height;
      }
      if (cursorCanvas) {
        cursorCanvas.width = canvas.width;
        cursorCanvas.height = canvas.height;
      }
      
      ctx.drawImage(tempCanvas, 0, 0);
    } else {
      // Diğer açılar için normal döndürme
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
      ctx.putImageData(imageData, 0, 0);
      ctx.restore();
    }

    originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width * zoom);
    const scaleY = canvas.height / (rect.height * zoom);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const updateCursor = (e) => {
    const pos = getMousePos(e);
    setCursorPos(pos);
    
    if (activeTool === 'eraser' || activeTool === 'brush' || activeTool === 'smart_brush') {
      setShowCursor(true);
      drawCursorPreview(pos);
    } else {
      setShowCursor(false);
      clearCursorPreview();
    }
  };

  const drawCursorPreview = (pos) => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const clearCursorPreview = () => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  };

  const clearOverlay = () => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  };

  const getResizeHandle = (pos) => {
    if (!cropSelection) return null;
    
    const { x, y, width, height } = cropSelection;
    const handleSize = 10;
    
    if (Math.abs(pos.x - x) < handleSize && Math.abs(pos.y - y) < handleSize) return 'nw';
    if (Math.abs(pos.x - (x + width)) < handleSize && Math.abs(pos.y - y) < handleSize) return 'ne';
    if (Math.abs(pos.x - x) < handleSize && Math.abs(pos.y - (y + height)) < handleSize) return 'sw';
    if (Math.abs(pos.x - (x + width)) < handleSize && Math.abs(pos.y - (y + height)) < handleSize) return 'se';
    
    if (Math.abs(pos.x - (x + width/2)) < handleSize && Math.abs(pos.y - y) < handleSize) return 'n';
    if (Math.abs(pos.x - (x + width/2)) < handleSize && Math.abs(pos.y - (y + height)) < handleSize) return 's';
    if (Math.abs(pos.x - x) < handleSize && Math.abs(pos.y - (y + height/2)) < handleSize) return 'w';
    if (Math.abs(pos.x - (x + width)) < handleSize && Math.abs(pos.y - (y + height/2)) < handleSize) return 'e';
    
    return null;
  };

  const isInsideCropSelection = (pos) => {
    if (!cropSelection) return false;
    const { x, y, width, height } = cropSelection;
    return pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height;
  };

  const constrainDimensions = (width, height) => {
    if (cropRatio === 'free' || !cropRatios[cropRatio].ratio) {
      return { width, height };
    }
    
    const ratio = cropRatios[cropRatio].ratio;
    if (width / height > ratio) {
      return { width: height * ratio, height };
    } else {
      return { width, height: width / ratio };
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const pos = getMousePos(e);
    
    if (activeTool === 'crop') {
      const handle = getResizeHandle(pos);
      if (handle) {
        setIsResizing(true);
        setResizeHandle(handle);
        setDragStart(pos);
      } else if (isInsideCropSelection(pos)) {
        setIsDragging(true);
        setDragStart({
          x: pos.x - cropSelection.x,
          y: pos.y - cropSelection.y
        });
      } else {
        setIsCropping(true);
        const initialSize = 100;
        const { width, height } = constrainDimensions(initialSize, initialSize);
        setCropSelection({
          x: pos.x,
          y: pos.y,
          width,
          height
        });
      }
    } else if (activeTool === 'eraser' || activeTool === 'brush') {
      setIsDrawing(true);
      drawBrush(pos);
    } else if (activeTool === 'smart_brush') {
      setIsDrawing(true);
      smartBrushErase(pos);
    } else if (activeTool === 'magic_wand') {
      magicWandSelect(pos);
    }
  };

  const handleMouseMove = (e) => {
    updateCursor(e);

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const pos = getMousePos(e);
    
    if (activeTool === 'crop') {
      if (isResizing && cropSelection) {
        const deltaX = pos.x - dragStart.x;
        const deltaY = pos.y - dragStart.y;
        let newSelection = { ...cropSelection };
        
        switch (resizeHandle) {
          case 'nw':
            newSelection.x += deltaX;
            newSelection.y += deltaY;
            newSelection.width -= deltaX;
            newSelection.height -= deltaY;
            break;
          case 'ne':
            newSelection.y += deltaY;
            newSelection.width += deltaX;
            newSelection.height -= deltaY;
            break;
          case 'sw':
            newSelection.x += deltaX;
            newSelection.width -= deltaX;
            newSelection.height += deltaY;
            break;
          case 'se':
            newSelection.width += deltaX;
            newSelection.height += deltaY;
            break;
          case 'n':
            newSelection.y += deltaY;
            newSelection.height -= deltaY;
            break;
          case 's':
            newSelection.height += deltaY;
            break;
          case 'w':
            newSelection.x += deltaX;
            newSelection.width -= deltaX;
            break;
          case 'e':
            newSelection.width += deltaX;
            break;
        }
        
        if (newSelection.width > 10 && newSelection.height > 10) {
          const constrained = constrainDimensions(newSelection.width, newSelection.height);
          newSelection.width = constrained.width;
          newSelection.height = constrained.height;
          setCropSelection(newSelection);
        }
        
        setDragStart(pos);
      } else if (isDragging && cropSelection) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const newX = Math.max(0, Math.min(canvas.width - cropSelection.width, pos.x - dragStart.x));
        const newY = Math.max(0, Math.min(canvas.height - cropSelection.height, pos.y - dragStart.y));
        
        setCropSelection({
          ...cropSelection,
          x: newX,
          y: newY
        });
      } else if (isCropping && cropSelection) {
        const width = Math.abs(pos.x - cropSelection.x);
        const height = Math.abs(pos.y - cropSelection.y);
        const constrained = constrainDimensions(width, height);
        
        setCropSelection({
          ...cropSelection,
          width: constrained.width,
          height: constrained.height
        });
      }
      
      drawCropOverlay();
    } else if ((activeTool === 'eraser' || activeTool === 'brush') && isDrawing) {
      drawBrush(pos);
    } else if (activeTool === 'smart_brush' && isDrawing) {
      smartBrushErase(pos);
    }
  };

  const handleMouseUp = (e) => {
    setIsPanning(false);
    setIsCropping(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragStart(null);
    
    if (activeTool === 'eraser' || activeTool === 'brush' || activeTool === 'smart_brush') {
      setIsDrawing(false);
      if (isDrawing) {
        saveToHistory();
      }
    }
  };

  const handleMouseLeave = () => {
    setShowCursor(false);
    clearCursorPreview();
    setIsDrawing(false);
    setIsPanning(false);
    setIsCropping(false);
    setIsDragging(false);
    setIsResizing(false);
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
      ctx.fillStyle = brushColor + 'CC';
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };

  const smartBrushErase = (pos) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const centerX = Math.floor(pos.x);
    const centerY = Math.floor(pos.y);
    const radius = brushSize / 2;
    
    if (centerX < 0 || centerX >= canvas.width || centerY < 0 || centerY >= canvas.height) return;
    
    const centerIndex = (centerY * canvas.width + centerX) * 4;
    const targetR = data[centerIndex];
    const targetG = data[centerIndex + 1];
    const targetB = data[centerIndex + 2];
    
    for (let x = Math.max(0, centerX - radius); x <= Math.min(canvas.width - 1, centerX + radius); x++) {
      for (let y = Math.max(0, centerY - radius); y <= Math.min(canvas.height - 1, centerY + radius); y++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance <= radius) {
          const index = (y * canvas.width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          
          const colorDiff = Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2);
          
          if (colorDiff <= tolerance) {
            const alpha = Math.max(0, 1 - (distance / radius));
            data[index + 3] *= (1 - alpha);
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  const drawCropOverlay = () => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !cropSelection) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    const { x, y, width, height } = cropSelection;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(x, y, width, height);
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    const handleSize = 8;
    ctx.fillStyle = '#00ff00';
    
    ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
    
    ctx.fillRect(x + width/2 - handleSize/2, y - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width/2 - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y - 25, 150, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(`${cropRatios[cropRatio].label} - Enter: Uygula`, x + 5, y - 10);
  };

  const applyCrop = () => {
    if (!cropSelection) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y, width, height } = cropSelection;
    
    if (width < 10 || height < 10) return;
    
    const imageData = ctx.getImageData(x, y, width, height);
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
    
    const overlayCanvas = overlayCanvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (overlayCanvas) {
      overlayCanvas.width = width;
      overlayCanvas.height = height;
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) overlayCtx.clearRect(0, 0, width, height);
    }
    if (cursorCanvas) {
      cursorCanvas.width = width;
      cursorCanvas.height = height;
    }
    
    setCropSelection(null);
    originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const magicWandSelect = (pos) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const startX = Math.floor(pos.x);
    const startY = Math.floor(pos.y);
    
    if (startX < 0 || startX >= canvas.width || startY < 0 || startY >= canvas.height) return;
    
    const startIndex = (startY * canvas.width + startX) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];
    
    if (targetA === 0) return;
    
    const visited = new Set();
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop();
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        continue;
      }
      
      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];
      
      if (a === 0) continue;
      
      const colorDiff = Math.sqrt((r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2);
      
      if (colorDiff <= tolerance) {
        visited.add(key);
        data[index + 3] = 0;
        
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    originalImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const downloadEditedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "duzenlenmis-gorsel.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-gray-800 rounded-lg w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Gelişmiş Görsel Editörü</h2>
          <button
            className="text-white hover:text-gray-300 transition-colors"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-700 bg-gray-700 overflow-x-auto">
          {/* Main Tools */}
          <div className="flex gap-2">
            <button
              className={`p-2 rounded ${activeTool === 'crop' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              onClick={() => setActiveTool('crop')}
              title="Kırp"
            >
              <Crop size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'eraser' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              onClick={() => setActiveTool('eraser')}
              title="Silgi"
            >
              <Eraser size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'brush' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              onClick={() => setActiveTool('brush')}
              title="Fırça"
            >
              <Brush size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'smart_brush' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              onClick={() => setActiveTool('smart_brush')}
              title="Akıllı Silgi"
            >
              <Wand2 size={20} />
            </button>
            <button
              className={`p-2 rounded ${activeTool === 'magic_wand' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
              onClick={() => setActiveTool('magic_wand')}
              title="Sihirli Değnek"
            >
              <Move size={20} />
            </button>
          </div>

          <div className="w-px h-8 bg-gray-600 mx-2"></div>

          {/* Transform Tools */}
          <div className="flex gap-2">
            <button
              onClick={() => flipHorizontal()}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 text-white"
              title="Yatay Çevir"
            >
              <FlipHorizontal size={20} />
            </button>
            <button
              onClick={() => flipVertical()}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 text-white"
              title="Dikey Çevir"
            >
              <FlipVertical size={20} />
            </button>
            <button
              onClick={() => rotateImage(90)}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 text-white"
              title="90° Döndür"
            >
              <Rotate90 size={20} />
            </button>
            <button
              onClick={() => rotateImage(-90)}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 text-white"
              title="-90° Döndür"
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <div className="w-px h-8 bg-gray-600 mx-2"></div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded ${showFilters ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'} text-white`}
            title="Filtreler"
          >
            <Palette size={20} />
          </button>

          {/* Crop Ratios */}
          {activeTool === 'crop' && (
            <>
              <div className="w-px h-8 bg-gray-600 mx-2"></div>
              <div className="flex gap-1">
                {Object.entries(cropRatios).map(([key, ratio]) => {
                  const IconComponent = ratio.icon;
                  return (
                    <button
                      key={key}
                      className={`p-2 rounded text-xs ${cropRatio === key ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'} text-white flex items-center gap-1`}
                      onClick={() => setCropRatio(key)}
                      title={ratio.label}
                    >
                      <IconComponent size={16} />
                      <span className="hidden sm:inline">{key}</span>
                    </button>
                  );
                })}
              </div>
              {cropSelection && (
                <button
                  onClick={applyCrop}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  title="Crop Uygula (Enter)"
                >
                  ✓ Crop
                </button>
              )}
            </>
          )}

          <div className="w-px h-8 bg-gray-600 mx-2"></div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white"
              title="Geri Al"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white"
              title="İleri Al"
            >
              <RotateCw size={20} />
            </button>
          </div>

          <div className="w-px h-8 bg-gray-600 mx-2"></div>

          {/* Brush Settings */}
          {(activeTool === 'eraser' || activeTool === 'brush' || activeTool === 'smart_brush') && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-white">Boyut:</label>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm w-8 text-white">{brushSize}</span>
              {activeTool === 'brush' && (
                <>
                  <label className="text-sm text-white ml-2">Renk:</label>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={e => setBrushColor(e.target.value)}
                    className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
                    title="Fırça Rengi"
                  />
                </>
              )}
            </div>
          )}

          {/* Tolerance */}
          {(activeTool === 'magic_wand' || activeTool === 'smart_brush') && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-white">Tolerans:</label>
              <input
                type="range"
                min="1"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm w-8 text-white">{tolerance}</span>
            </div>
          )}

          <div className="w-px h-8 bg-gray-600 mx-2"></div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 text-white"
              title="Uzaklaştır"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-sm w-12 text-center text-white">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(5, zoom + 0.1))}
              className="p-2 rounded bg-gray-600 hover:bg-gray-500 text-white"
              title="Yakınlaştır"
            >
              <ZoomIn size={20} />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-gray-700 bg-gray-750">
            {/* Filter Presets */}
            <div className="mb-4">
              <h3 className="text-white text-sm font-medium mb-2">Hazır Filtreler</h3>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(filterPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyFilterPreset(key)}
                    className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                  >
                    {preset.name}
                  </button>
                ))}
                <button
                  onClick={resetFilters}
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Sıfırla
                </button>
              </div>
            </div>

            {/* Manual Filter Controls */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Sun size={14} /> Parlaklık
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.brightness}
                  onChange={e => setFilters({...filters, brightness: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.brightness}%</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Contrast size={14} /> Kontrast
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.contrast}
                  onChange={e => setFilters({...filters, contrast: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.contrast}%</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Droplets size={14} /> Doygunluk
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.saturation}
                  onChange={e => setFilters({...filters, saturation: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.saturation}%</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Palette size={14} /> Renk Tonu
                </label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={filters.hue}
                  onChange={e => setFilters({...filters, hue: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.hue}°</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Eye size={14} /> Bulanıklık
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={filters.blur}
                  onChange={e => setFilters({...filters, blur: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.blur}px</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Moon size={14} /> Sepya
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.sepia}
                  onChange={e => setFilters({...filters, sepia: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.sepia}%</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <ImageIcon size={14} /> Gri Ton
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.grayscale}
                  onChange={e => setFilters({...filters, grayscale: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.grayscale}%</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Zap size={14} /> Ters Çevir
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.invert}
                  onChange={e => setFilters({...filters, invert: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.invert}%</span>
              </div>

              <div>
                <label className="text-white text-xs mb-1 block flex items-center gap-1">
                  <Sparkles size={14} /> Opaklık
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.opacity}
                  onChange={e => setFilters({...filters, opacity: Number(e.target.value)})}
                  className="w-full"
                />
                <span className="text-xs text-gray-400">{filters.opacity}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div 
          className="flex-1 bg-gray-900 relative overflow-hidden cursor-crosshair" 
          ref={containerRef}
          style={{ cursor: activeTool === 'pan' ? 'move' : 'crosshair' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="relative" 
              style={{ 
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)` 
              }}
            >
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
                className="border border-gray-600"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 pointer-events-none"
              />
              <canvas
                ref={cursorCanvasRef}
                className="absolute top-0 left-0 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {activeTool === 'crop' && !cropSelection && "Kırpma alanı oluşturmak için tıklayın"}
            {activeTool === 'crop' && cropSelection && "Alanı hareket ettirin veya boyutlandırın - Enter: Uygula, Esc: İptal"}
            {activeTool === 'eraser' && "Silmek istediğiniz alanları boyayın"}
            {activeTool === 'brush' && "Boyamak istediğiniz alanları işaretleyin"}
            {activeTool === 'smart_brush' && "Benzer renkteki alanları silmek için boyayın"}
            {activeTool === 'magic_wand' && "Benzer renkteki alanları seçmek için tıklayın"}
            <span className="ml-4 text-xs">
              • Ctrl/Cmd + Tekerlek: Zoom • Orta Tuş: Pan
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={onClose}
            >
              Vazgeç
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
              onClick={downloadEditedImage}
            >
              <Download size={18} /> İndir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}