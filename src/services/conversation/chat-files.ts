import type { ChatMessageAttachment } from "@/types";

type ChatInputFileKind = "text" | "pdf" | "docx" | "xlsx";

export type ChatInputAttachment = ChatMessageAttachment;

export const CHAT_INPUT_FILE_MAX_MB = 20;
export const CHAT_INPUT_FILE_MAX_CHARS = 120000;
export const CHAT_INPUT_PDF_MAX_PAGES = 20;
export const CHAT_INPUT_XLSX_MAX_SHEETS = 8;
export const CHAT_INPUT_XLSX_MAX_ROWS = 200;

const CHAT_INPUT_FILE_ACCEPT_PARTS = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".jsonl",
  ".csv",
  ".log",
  ".xml",
  ".html",
  ".htm",
  ".yaml",
  ".yml",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".less",
  ".py",
  ".sh",
  ".ini",
  ".toml",
  ".sql",
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".xlsm",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/xhtml+xml",
  "application/x-yaml",
  "application/yaml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
].join(",");

const CHAT_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/xhtml+xml",
  "application/x-yaml",
  "application/yaml",
]);

const CHAT_TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".jsonl",
  ".csv",
  ".log",
  ".xml",
  ".html",
  ".htm",
  ".yaml",
  ".yml",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".less",
  ".py",
  ".sh",
  ".ini",
  ".toml",
  ".sql",
]);

const CHAT_DOCX_MIME_TYPES = new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const CHAT_PDF_MIME_TYPES = new Set(["application/pdf"]);
const CHAT_XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
]);

const CHAT_XLSX_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm"]);

const CHAT_FILE_KIND_LABELS: Record<ChatInputFileKind, string> = {
  text: "TXT",
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
};

let pdfWorkerConfigured = false;
let pdfModulePromise: Promise<typeof import("pdfjs-dist")> | null = null;
let mammothModulePromise: Promise<typeof import("mammoth")> | null = null;
let xlsxModulePromise: Promise<typeof import("xlsx")> | null = null;

export function getChatInputFileAccept(): string {
  return CHAT_INPUT_FILE_ACCEPT_PARTS;
}

export function formatChatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function normalizeFileName(name: string): string {
  return (
    String(name || "file")
      .replace(/\s+/g, " ")
      .trim() || "file"
  );
}

function normalizeTextContent(text: string): string {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n");
}

function getFileExtension(fileName: string): string {
  const normalized = String(fileName || "").toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return normalized.slice(dotIndex);
}

export function getChatInputFileKind(file: File): ChatInputFileKind | null {
  const contentType = String(file?.type || "").toLowerCase();
  const ext = getFileExtension(file?.name || "");

  if (contentType.startsWith("text/") || CHAT_TEXT_MIME_TYPES.has(contentType) || CHAT_TEXT_EXTENSIONS.has(ext)) {
    return "text";
  }

  if (CHAT_PDF_MIME_TYPES.has(contentType) || ext === ".pdf") return "pdf";
  if (CHAT_DOCX_MIME_TYPES.has(contentType) || ext === ".docx") return "docx";
  if (CHAT_XLSX_MIME_TYPES.has(contentType) || CHAT_XLSX_EXTENSIONS.has(ext)) return "xlsx";

  return null;
}

export function isReadableChatFile(file: File): boolean {
  return Boolean(getChatInputFileKind(file));
}

export function getChatInputFileKindLabel(kind: ChatInputFileKind): string {
  return CHAT_FILE_KIND_LABELS[kind] || kind.toUpperCase();
}

function getChatInputFileContentType(file: File, kind: ChatInputFileKind): string {
  const contentType = String(file?.type || "").trim();
  if (contentType) return contentType;

  if (kind === "pdf") return "application/pdf";
  if (kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (kind === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/plain";
}

function clampChatFileText(text: string): { text: string; truncated: boolean } {
  const normalized = normalizeTextContent(text);
  if (normalized.length <= CHAT_INPUT_FILE_MAX_CHARS) {
    return { text: normalized, truncated: false };
  }

  return {
    text: normalized.slice(0, CHAT_INPUT_FILE_MAX_CHARS),
    truncated: true,
  };
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return String(await file.text());
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return await file.arrayBuffer();
  }

  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

async function loadPdfModule(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfModulePromise) {
    pdfModulePromise = import("pdfjs-dist");
  }

  const module = await pdfModulePromise;
  if (!pdfWorkerConfigured && typeof window !== "undefined" && module.GlobalWorkerOptions) {
    module.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    pdfWorkerConfigured = true;
  }

  return module;
}

async function loadMammothModule(): Promise<typeof import("mammoth")> {
  if (!mammothModulePromise) {
    mammothModulePromise = import("mammoth");
  }

  return mammothModulePromise;
}

async function loadXlsxModule(): Promise<typeof import("xlsx")> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }

  return xlsxModulePromise;
}

function collectPdfPageText(pageText: { items?: Array<{ str?: string; hasEOL?: boolean }> } | null | undefined): string {
  if (!pageText || !Array.isArray(pageText.items)) return "";

  const parts: string[] = [];
  pageText.items.forEach((item) => {
    const text = String(item?.str || "");
    if (!text) return;
    parts.push(text);
    parts.push(item?.hasEOL ? "\n" : " ");
  });

  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(file: File): Promise<{ text: string; truncated: boolean }> {
  const module = await loadPdfModule();
  const data = new Uint8Array(await readFileAsArrayBuffer(file));
  const loadingTask = module.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const pageLimit = Math.min(pdf.numPages, CHAT_INPUT_PDF_MAX_PAGES);
  const truncated = pdf.numPages > pageLimit;

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const pageText = await page.getTextContent({ disableNormalization: false });
    const content = collectPdfPageText(pageText as { items?: Array<{ str?: string; hasEOL?: boolean }> });
    if (!content) continue;
    pages.push(`[Page ${pageNumber}]\n${content}`);
  }

  const body = pages.join("\n\n");
  return {
    text: truncated ? `${body}\n\n[PDF truncated after ${pageLimit} pages]` : body,
    truncated,
  };
}

async function extractDocxText(file: File): Promise<{ text: string; truncated: boolean }> {
  const mammoth = await loadMammothModule();
  const result = await mammoth.extractRawText({ arrayBuffer: await readFileAsArrayBuffer(file) });
  return { text: String(result?.value || ""), truncated: false };
}

function getWorksheetNames(workbook: { SheetNames?: string[] } | null | undefined): string[] {
  return Array.isArray(workbook?.SheetNames) ? workbook!.SheetNames : [];
}

async function extractXlsxText(file: File): Promise<{ text: string; truncated: boolean }> {
  const XLSX = await loadXlsxModule();
  const workbook = XLSX.read(await readFileAsArrayBuffer(file), { type: "array" });
  const sheetNames = getWorksheetNames(workbook).slice(0, CHAT_INPUT_XLSX_MAX_SHEETS);
  const sections: string[] = [];
  let truncated = getWorksheetNames(workbook).length > sheetNames.length;

  sheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets?.[sheetName];
    if (!sheet) return;

    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (!csv.trim()) return;

    const lines = csv.split(/\r?\n/);
    const limitedLines = lines.slice(0, CHAT_INPUT_XLSX_MAX_ROWS);
    const sheetTruncated = lines.length > limitedLines.length;
    sections.push(`[Sheet ${sheetName}]\n${limitedLines.join("\n")}`);
    if (sheetTruncated) {
      sections.push(`[Sheet ${sheetName} truncated after ${CHAT_INPUT_XLSX_MAX_ROWS} rows]`);
      truncated = true;
    }
  });

  if (getWorksheetNames(workbook).length > sheetNames.length) {
    sections.push(`[Workbook truncated after ${sheetNames.length} sheets]`);
  }

  return {
    text: sections.join("\n\n"),
    truncated,
  };
}

async function extractFileText(file: File, kind: ChatInputFileKind): Promise<{ text: string; truncated: boolean }> {
  if (kind === "text") {
    return { text: await readFileAsText(file), truncated: false };
  }

  if (kind === "pdf") {
    return await extractPdfText(file);
  }

  if (kind === "docx") {
    return await extractDocxText(file);
  }

  if (kind === "xlsx") {
    return await extractXlsxText(file);
  }

  return { text: "", truncated: false };
}

export async function parseChatInputFile(file: File): Promise<ChatInputAttachment | null> {
  const kind = getChatInputFileKind(file);
  if (!kind) return null;

  const extracted = await extractFileText(file, kind);
  const clamped = clampChatFileText(extracted.text);

  return {
    id: "",
    name: normalizeFileName(file.name || "file"),
    contentType: getChatInputFileContentType(file, kind),
    size: file.size,
    text: clamped.text,
    truncated: extracted.truncated || clamped.truncated,
    kind,
    kindLabel: getChatInputFileKindLabel(kind),
  };
}

export function buildChatFileContextBlock(attachment: ChatInputAttachment, index: number, total: number): string {
  const parts = [
    `[Attached file ${index + 1}/${total}]`,
    `name: ${normalizeFileName(attachment.name)}`,
    `kind: ${attachment.kindLabel}`,
    `type: ${attachment.contentType || "text/plain"}`,
    `size: ${formatChatFileSize(attachment.size)}`,
    attachment.truncated ? `note: content truncated to ${CHAT_INPUT_FILE_MAX_CHARS.toLocaleString()} characters` : "",
    "content:",
    attachment.text || "[empty file]",
    `[/Attached file ${index + 1}/${total}]`,
  ];

  return parts.filter(Boolean).join("\n");
}

export function buildChatAttachmentDownloadFilename(attachment: ChatInputAttachment, original = true): string {
  const name = normalizeFileName(attachment.name);
  if (original || attachment.kind === "text") return name;

  const baseName = name.replace(/\.[^.]+$/, "") || "attachment";
  return `${baseName}.txt`;
}

export function composeChatPromptText(text: string, attachments: ChatInputAttachment[] = []): string {
  const promptText = String(text || "").trim();
  const fileBlocks = attachments.map((attachment, index) => buildChatFileContextBlock(attachment, index, attachments.length));
  const segments = [...fileBlocks, promptText].filter(Boolean);
  return normalizeTextContent(segments.join("\n\n")).trim();
}
