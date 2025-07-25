class ICOConverter {
  constructor() {
    this.selectedFile = null;
    this.originalAspectRatio = 1;
    this.initializeEventListeners();
    this.updateQualityDisplay();
  }

  initializeEventListeners() {
    const uploadArea = document.getElementById("uploadArea");
    const fileInput = document.getElementById("fileInput");
    const qualitySlider = document.getElementById("qualitySlider");
    const convertBtn = document.getElementById("convertBtn");

    // Drag and drop events
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // File input change
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelect(e.target.files[0]);
      }
    });

    // Quality slider input
    qualitySlider.addEventListener("input", () => {
      this.updateQualityDisplay();
    });

    // Convert button click
    convertBtn.addEventListener("click", () => {
      this.convertToICO();
    });
  }

  handleFileSelect(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB.");
      return;
    }

    this.selectedFile = file;
    this.showPreview(file);
    document.getElementById("convertBtn").style.display = "block";
  }

  showPreview(file) {
    const previewArea = document.getElementById("previewArea");
    const previewGrid = document.getElementById("previewGrid");

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Store aspect ratio for later use
        this.originalAspectRatio = img.width / img.height;

        previewGrid.innerHTML = `<div class="preview-item"><img src="${
          e.target.result
        }" alt="Original Image" style="max-width: 100px; max-height: 100px"><p><strong>Original</strong><br>${
          img.width
        }×${img.height}px<br>Ratio: ${this.originalAspectRatio.toFixed(
          2
        )}</p></div>`;
        previewArea.style.display = "block";
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  updateQualityDisplay() {
    const slider = document.getElementById("qualitySlider");
    const display = document.getElementById("qualityValue");
    display.textContent = Math.round(slider.value * 100) + "%";
  }

  getSelectedSizes() {
    const checkboxes = document.querySelectorAll(
      '.size-option input[type="radio"]:checked'
    );
    return Array.from(checkboxes).map((cb) => parseInt(cb.value));
  }

  // Calculate dimensions maintaining aspect ratio
  calculateDimensions(targetSize, aspectRatio) {
    let width, height;

    if (aspectRatio >= 1) {
      // Landscape or square - width is limiting factor
      width = targetSize;
      height = Math.round(targetSize / aspectRatio);
    } else {
      // Portrait - height is limiting factor
      height = targetSize;
      width = Math.round(targetSize * aspectRatio);
    }

    return { width, height };
  }

  async convertToICO() {
    if (!this.selectedFile) return;

    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    const convertBtn = document.getElementById("convertBtn");

    progressBar.style.display = "block";
    convertBtn.disabled = true;
    convertBtn.textContent = "🔄 Converting...";

    try {
      const sizes = this.getSelectedSizes();
      const quality = parseFloat(
        document.getElementById("qualitySlider").value
      );

      if (sizes.length === 0) {
        return alert("Please select at least one icon size.");
      }

      // Create image from file
      const img = await this.createImageFromFile(this.selectedFile);

      // Generate ICO data with aspect ratio preserved
      const icoBlob = await this.generateICO(img, sizes, quality);

      progressFill.style.width = "100%";

      // Show download option
      setTimeout(() => {
        this.showDownload(icoBlob);
        progressBar.style.display = "none";
        convertBtn.disabled = false;
        convertBtn.textContent = "🔄 Convert to ICO";
      }, 500);
    } catch (error) {
      console.error("Conversion error:", error);
      alert("Error during conversion. Please try again.");
      progressBar.style.display = "none";
      convertBtn.disabled = false;
      convertBtn.textContent = "🔄 Convert to ICO";
    }
  }

  createImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async generateICO(sourceImg, sizes, quality) {
    const progressFill = document.getElementById("progressFill");
    let progress = 0;
    const increment = 80 / sizes.length;

    // Create canvases for each size
    const imageData = [];

    for (let size of sizes) {
      // Calculate dimensions preserving aspect ratio
      const dimensions = this.calculateDimensions(
        size,
        this.originalAspectRatio
      );

      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const ctx = canvas.getContext("2d");

      // Set high quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw image with preserved aspect ratio
      ctx.drawImage(sourceImg, 0, 0, dimensions.width, dimensions.height);

      // Convert to PNG blob
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png", quality);
      });

      const arrayBuffer = await blob.arrayBuffer();
      imageData.push({
        width: dimensions.width,
        height: dimensions.height,
        data: new Uint8Array(arrayBuffer),
      });

      progress += increment;
      progressFill.style.width = progress + "%";
    }

    // Create ICO file structure
    const icoData = this.createICOFile(imageData);
    progressFill.style.width = "90%";

    return new Blob([icoData], { type: "image/x-icon" });
  }

  createICOFile(imageData) {
    // ICO file header (6 bytes)
    const header = new ArrayBuffer(6);
    const headerView = new DataView(header);
    headerView.setUint16(0, 0, true); // Reserved field
    headerView.setUint16(2, 1, true); // Type (1 for ICO)
    headerView.setUint16(4, imageData.length, true); // Number of images

    // Calculate directory size and data offset
    const directorySize = imageData.length * 16;
    let dataOffset = 6 + directorySize;

    // Create directory entries
    const directory = new ArrayBuffer(directorySize);
    const dirView = new DataView(directory);

    let currentOffset = dataOffset;
    for (let i = 0; i < imageData.length; i++) {
      const entry = imageData[i];
      const offset = i * 16;

      // Use actual dimensions instead of assuming square
      dirView.setUint8(offset, entry.width === 256 ? 0 : entry.width); // Width
      dirView.setUint8(offset + 1, entry.height === 256 ? 0 : entry.height); // Height
      dirView.setUint8(offset + 2, 0); // Color palette count
      dirView.setUint8(offset + 3, 0); // Reserved
      dirView.setUint16(offset + 4, 1, true); // Color planes
      dirView.setUint16(offset + 6, 32, true); // Bits per pixel
      dirView.setUint32(offset + 8, entry.data.length, true); // Image data size
      dirView.setUint32(offset + 12, currentOffset, true); // Image data offset

      currentOffset += entry.data.length;
    }

    // Combine all parts into final ICO file
    const totalSize =
      6 +
      directorySize +
      imageData.reduce((sum, entry) => sum + entry.data.length, 0);
    const result = new Uint8Array(totalSize);

    let pos = 0;
    result.set(new Uint8Array(header), pos);
    pos += 6;
    result.set(new Uint8Array(directory), pos);
    pos += directorySize;

    for (let entry of imageData) {
      result.set(entry.data, pos);
      pos += entry.data.length;
    }

    return result;
  }

  showDownload(blob) {
    const downloadArea = document.getElementById("downloadArea");
    const downloadBtn = document.getElementById("downloadBtn");

    const url = URL.createObjectURL(blob);
    downloadBtn.href = url;
    downloadBtn.download = "favicon.ico";

    downloadArea.style.display = "block";
    downloadArea.scrollIntoView({ behavior: "smooth" });
  }
}

// Initialize converter when page loads
document.addEventListener("DOMContentLoaded", () => {
  new ICOConverter();
});
