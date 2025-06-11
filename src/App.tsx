import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  env,
  AutoModel,
  AutoProcessor,
  RawImage,
} from "@huggingface/transformers";
import "onnxruntime-web";

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

  const modelRef = useRef<any>(null);
  const processorRef = useRef<any>(null);

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
        // Cookie'den yükle
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
  const processImage = async (file: File): Promise<string> => {
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
      // Eğer sınırı aşacaksa, en sondaki (en eski) görseli sil
      if (newImages.length >= MAX_IMAGES) {
        newImages.pop();
      }
      const processedUrl: string = await processImage(file);
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

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png"],
    },
  });

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
          <p className="text-sm text-gray-400">veya tıklayarak seçin (en fazla 5)</p>
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
                  className="mx-2 px-3 py-1 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200 text-sm"
                  aria-label={`Görseli panoya kopyala`}
                >
                  Kopyala
                </button>
                <button
                  onClick={() => downloadImage(img.processedUrl, img.name.replace(/\.[^/.]+$/, "") + "-arkaplan-kaldirildi.png")}
                  className="mx-2 px-3 py-1 bg-white text-gray-900 rounded-md hover:bg-gray-200 transition-colors duration-200 text-sm"
                  aria-label={`Görseli indir`}
                >
                  İndir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
