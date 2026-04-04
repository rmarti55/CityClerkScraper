import { NextRequest } from 'next/server';
import { getPdfBuffer, getAttachmentPdfBuffer } from '@/lib/file-cache';

interface FileEntry {
  fileId: number;
  name: string;
}

interface AttachmentEntry {
  id: number;
  agendaId: number;
  name: string;
}

interface ProgressRequest {
  files?: FileEntry[];
  attachments?: AttachmentEntry[];
}

const CONCURRENCY = 10;

export async function POST(request: NextRequest) {
  let body: ProgressRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fileEntries = body.files ?? [];
  const attachmentEntries = body.attachments ?? [];
  const total = fileEntries.length + attachmentEntries.length;

  if (total === 0) {
    return new Response(JSON.stringify({ error: 'No documents specified' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let fetched = 0;
  const errors: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      type Task = { kind: 'file'; entry: FileEntry } | { kind: 'attachment'; entry: AttachmentEntry };
      const tasks: Task[] = [
        ...fileEntries.map((entry) => ({ kind: 'file' as const, entry })),
        ...attachmentEntries.map((entry) => ({ kind: 'attachment' as const, entry })),
      ];

      let cursor = 0;

      async function runTask(task: Task) {
        const name = task.kind === 'file' ? task.entry.name : task.entry.name;
        try {
          if (task.kind === 'file') {
            await getPdfBuffer(task.entry.fileId);
          } else {
            await getAttachmentPdfBuffer(task.entry.id, task.entry.agendaId);
          }
        } catch {
          const id = task.kind === 'file' ? `file ${task.entry.fileId}` : `attachment ${task.entry.id}`;
          errors.push(`Failed to fetch ${id}`);
        }
        fetched++;
        send({ fetched, total, currentFile: name });
      }

      async function worker() {
        while (true) {
          const idx = cursor++;
          if (idx >= tasks.length) break;
          await runTask(tasks[idx]);
        }
      }

      const workers = Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker());
      await Promise.all(workers);

      send({ done: true, total, fetched, errors: errors.length > 0 ? errors : undefined });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
