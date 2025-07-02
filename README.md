# Background Remover

Bu proje, tarayıcı tabanlı bir arka plan kaldırma uygulamasıdır. Kullanıcıların görseller yüklemesine, yapay zeka destekli model ile otomatik olarak arka planlarını kaldırmasına ve ardından çeşitli araçlarla düzenleme yapmasına olanak tanır.

## ✨ Özellikler

-   **🤖 Otomatik Arka Plan Kaldırma:** [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js/index) ve [ONNX Runtime](https://onnxruntime.ai/) kullanarak görsellerin arka planını otomatik olarak kaldırır.
-   **🖼️ Görsel Yükleme:** Sürükle-bırak veya dosya seçici ile kolayca görsel yükleme.
-   **✏️ Düzenleme Araçları:**
    -   **Kırpma:** Görselin istenmeyen kısımlarını kesin.
    -   **Silgi & Fırça:** Arka plan veya ön planı manuel olarak ince ayar yapın.
    -   **Sihirli Değnek:** Benzer renkli alanları tek tıkla seçip silin.
    -   **Geri Al/Yinele:** Düzenleme adımlarında kolayca gezinin.
-   **💻 Tarayıcı Tabanlı:** Tüm işlemler kullanıcının tarayıcısında gerçekleşir, sunucuya görsel yüklenmez. Bu, gizliliği ve hızı artırır.
-   **🍪 Oturum Hatırlama:** Yüklenen ve işlenen görseller, tarayıcı çerezleri kullanılarak sonraki ziyaretler için hatırlanır.
-   **📥 İndirme & Kopyalama:** İşlenmiş veya düzenlenmiş görselleri kolayca indirin veya panoya kopyalayın.

## 🛠️ Kullanılan Teknolojiler

-   **Frontend:** [React](https://react.dev/)
-   **Build Aracı:** [Vite](https://vitejs.dev/)
-   **Dil:** [TypeScript](https://www.typescriptlang.org/)
-   **Stil:** [Tailwind CSS](https://tailwindcss.com/)
-   **AI Model:** [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js/index)
-   **Model Çalıştırma:** [ONNX Runtime Web](https://onnxruntime.ai/)
-   **İkonlar:** [Lucide React](https://lucide.dev/guide/packages/lucide-react)

## 🚀 Projeyi Çalıştırma

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler

-   [Node.js](https://nodejs.org/en) (v18 veya üstü önerilir)
-   [npm](https://www.npmjs.com/) (Node.js ile birlikte gelir)

### Kurulum

1.  Proje dosyalarını klonlayın veya indirin.
2.  Proje dizinine gidin:
    ```bash
    cd bg-remover
    ```
3.  Gerekli paketleri yükleyin:
    ```bash
    npm install
    ```

### Geliştirme Sunucusunu Başlatma

Projeyi geliştirme modunda çalıştırmak için aşağıdaki komutu kullanın:

```bash
npm run dev
```

Bu komut, projeyi `http://localhost:5173` (veya boşta olan başka bir port) adresinde başlatacaktır.

## Kullanım

1.  Uygulamayı tarayıcınızda açın.
2.  "Görselleri buraya sürükleyip bırakın" alanına bir veya daha fazla görsel sürükleyin veya alana tıklayarak dosyalarınızı seçin.
3.  Görseller otomatik olarak işlenecek ve arka planları kaldırılmış halleriyle görüntülenecektir.
4.  Bir görselin üzerine gelerek **Sil**, **İndir** veya **Düzenle** seçeneklerini kullanabilirsiniz.
5.  **Düzenle** butonuna tıkladığınızda açılan pencerede çeşitli araçları kullanarak görsel üzerinde ince ayarlar yapabilirsiniz.

## 📜 Mevcut Scriptler

-   `npm run dev`: Geliştirme sunucusunu başlatır.
-   `npm run build`: Projeyi üretim için `build` klasörüne derler.
-   `npm run lint`: Kod stilini ve olası hataları denetler.
-   `npm run preview`: Üretim derlemesinin önizlemesini sunar.