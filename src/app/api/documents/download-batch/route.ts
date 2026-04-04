import { NextRequest, NextResponse } from 'next/server';
import { getPdfBuffer, getAttachmentPdfBuffer } from '@/lib/file-cache';
import { Zip, ZipPassThrough, strToU8 } from 'fflate';

interface FileEntry {
  fileId: number;
  name: string;
}

interface AttachmentEntry {
  id: number;
  agendaId: number;
  name: string;
}

interface BatchRequest {
  files?: FileEntry[];
  attachments?: AttachmentEntry[];
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim() || 'document';
}

function ensurePdfExtension(name: string): string {
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

function dedupeFilename(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (used.has(`${base} (${i})${ext}`)) i++;
  const deduped = `${base} (${i})${ext}`;
  used.add(deduped);
  return deduped;
}

export async function POST(request: NextRequest) {
  let body: BatchRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fileEntries = body.files ?? [];
  const attachmentEntries = body.attachments ?? [];
  const totalItems = fileEntries.length + attachmentEntries.length;

  if (totalItems === 0) {
    return NextResponse.json({ error: 'No documents specified' }, { status: 400 });
  }

  // Single file: serve directly as PDF (no zip needed)
  if (totalItems === 1 && fileEntries.length === 1) {
    const entry = fileEntries[0];
    const buffer = await getPdfBuffer(entry.fileId);
    if (!buffer) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const filename = ensurePdfExtension(sanitizeFilename(entry.name));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  if (totalItems === 1 && attachmentEntries.length === 1) {
    const entry = attachmentEntries[0];
    const buffer = await getAttachmentPdfBuffer(entry.id, entry.agendaId);
    if (!buffer) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    const filename = ensurePdfExtension(sanitizeFilename(entry.name));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // Multiple files: stream a zip using fflate's async Zip API.
  // Files are read from disk cache one at a time (pre-fetched by the progress endpoint)
  // and piped into the zip stream, keeping memory usage low.
  const usedNames = new Set<string>();
  const errors: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        if (chunk) controller.enqueue(chunk);
        if (final) controller.close();
      });

      // Process files sequentially to keep memory bounded
      for (const entry of fileEntries) {
        try {
          const buffer = await getPdfBuffer(entry.fileId);
          if (buffer) {
            const name = dedupeFilename(ensurePdfExtension(sanitizeFilename(entry.name)), usedNames);
            const passthrough = new ZipPassThrough(name);
            zip.add(passthrough);
            passthrough.push(new Uint8Array(buffer), true);
          } else {
            errors.push(`File ${entry.fileId} not found`);
          }
        } catch {
          errors.push(`Failed to fetch file ${entry.fileId}`);
        }
      }

      for (const entry of attachmentEntries) {
        try {
          const buffer = await getAttachmentPdfBuffer(entry.id, entry.agendaId);
          if (buffer) {
            const name = dedupeFilename(ensurePdfExtension(sanitizeFilename(entry.name)), usedNames);
            const passthrough = new ZipPassThrough(name);
            zip.add(passthrough);
            passthrough.push(new Uint8Array(buffer), true);
          } else {
            errors.push(`Attachment ${entry.id} not found`);
          }
        } catch {
          errors.push(`Failed to fetch attachment ${entry.id}`);
        }
      }

      if (errors.length > 0) {
        const errFile = new ZipPassThrough('_download_errors.txt');
        zip.add(errFile);
        errFile.push(strToU8(`The following documents could not be included:\n\n${errors.join('\n')}\n`), true);
      }

      zip.end();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="documents.zip"',
      'Transfer-Encoding': 'chunked',
    },
  });
}
