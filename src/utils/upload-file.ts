// @ts-nocheck
import deleteIcon from "@/assets/svg/delete32.svg";
import { tr } from "@/i18n";
import { dsAlert } from "@/utils/daisy-ui-alert";
import { createSvgIcon } from "@/utils/svg-icon";

const GlobalInputUploadEl = "global-file-upload-input";
const ImageMaxMBSize = 20;

const displayImage = (base64Image) => {
  const imgContainer = document.getElementById("ccia-chat-input-imgs");
  const itemElem = document.createElement("div");
  itemElem.classList.add("ccia-item");
  itemElem.addEventListener("click", () => {
    itemElem.remove();
  });

  const imgElement = document.createElement("img");
  imgElement.classList.add("ccia-image");
  imgElement.src = base64Image;

  const hoverItem = document.createElement("div");
  hoverItem.classList.add("ccia-hover-item");

  const deleteButtonElem = document.createElement("div");
  deleteButtonElem.classList.add("ccia-hover-button");
  deleteButtonElem.appendChild(createSvgIcon(deleteIcon, { size: "32px" }));
  hoverItem.appendChild(deleteButtonElem);

  itemElem.appendChild(hoverItem);
  itemElem.appendChild(imgElement);
  imgContainer.appendChild(itemElem);
};

/** Read one uploaded image file and render it into the chat input preview list. */
const handleImageFile = (file) => {
  if (file) {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > ImageMaxMBSize) {
      dsAlert({ type: "error", message: tr("toast.imageTooLarge", { max: ImageMaxMBSize }) });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      displayImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }
};

/** Handle image input change events. */
const onLoadImageFile = (event) => {
  const file = event.target.files[0];
  handleImageFile(file);
};

/** Read and parse one uploaded JSON file. */
const onLoadJsonFile = (event) => {
  return new Promise((resolve) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const textContent = String(e.target.result || "").replace(/^\uFEFF/, "");
          const jsonContent = JSON.parse(textContent);
          resolve(jsonContent);
        } catch (error) {
          resolve({
            __jsonParseError: String(error?.message || error || "Unknown JSON parse error"),
          });
        }
      };
      reader.readAsText(file);
    } else {
      resolve(null);
    }
  });
};

/** Open the shared hidden file input and process the selected file with one handler. */
const handleFileUpload = (acceptType, handler) => {
  return new Promise((resolve) => {
    const fileInput = document.getElementById(GlobalInputUploadEl);
    const wrappedHandler = async (event) => {
      const result = await handler(event);
      fileInput.value = "";
      fileInput.removeEventListener("change", wrappedHandler);
      resolve(result);
    };
    fileInput.removeEventListener("change", wrappedHandler);
    fileInput.accept = acceptType;
    fileInput.addEventListener("change", wrappedHandler);
    fileInput.click();
  });
};

/** Handle pasted image files from the clipboard. */
const handlePasted = (event) => {
  const items = event.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
      const file = items[i].getAsFile();
      handleImageFile(file);
      event.preventDefault();
      return;
    }
  }
};

/** Trigger image file upload for the chat input. */
export const uploadImageFile = () => {
  handleFileUpload("image/*", onLoadImageFile);
};

/** Trigger JSON file upload. */
export const uploadJsonFile = () => {
  return handleFileUpload("application/json", onLoadJsonFile);
};

/** Attach the shared paste listener to one DOM element. */
export const addPasteEvent = (domId) => {
  document.getElementById(domId).addEventListener("paste", handlePasted);
};

/** Remove the shared paste listener from one DOM element. */
export const removePasteEvent = (domId) => {
  document.getElementById(domId).removeEventListener("paste", handlePasted);
};
