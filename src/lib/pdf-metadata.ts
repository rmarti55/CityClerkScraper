import { PDFDocument } from "pdf-lib";

export async function getPdfPageCount(data: Buffer): Promise<number | null> {
  try {
    const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.warn("Failed to parse PDF for page count:", error);
    return null;
  }
}
