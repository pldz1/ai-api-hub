// @ts-nocheck

/** Copy one rendered image element to the clipboard as PNG. */
export async function copyToClipboard(imgElement) {
  const canvas = document.createElement("canvas");
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElement, 0, 0);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    return false;
  }

  try {
    const clipboardItem = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (error) {
    console.error("Failed to copy image to clipboard:", error);
    return false;
  }
}

function downloadBlob(blob, filename = "file.bin") {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Failed to download file locally:", error);
    return false;
  }
}

export async function saveBlobToLocal(blob, filename = "file.bin") {
  return downloadBlob(blob, filename);
}

/** Save one rendered image element to a local PNG file. */
export async function saveToLocal(imgElement, filename = "image.png") {
  const canvas = document.createElement("canvas");
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElement, 0, 0);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    return false;
  }

  return downloadBlob(blob, filename);
}

/** Save plain text content to a local file. */
export async function saveTextToLocal(text, filename = "file.txt", type = "text/plain;charset=utf-8") {
  const blob = new Blob([String(text || "")], { type });
  return downloadBlob(blob, filename);
}
