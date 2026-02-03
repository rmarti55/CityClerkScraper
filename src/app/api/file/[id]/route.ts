import { NextRequest, NextResponse } from "next/server";
import { getFileDownloadUrl } from "@/lib/civicclerk";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);

  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const downloadUrl = getFileDownloadUrl(fileId);
  const isDownload = request.nextUrl.searchParams.get("download") === "true";

  try {
    const response = await fetch(downloadUrl, {
      headers: {
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");
    
    // Extract filename from content-disposition if available
    let filename = `file-${fileId}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/['"]/g, "");
      }
    }

    const headers: HeadersInit = {
      "Content-Type": contentType,
    };

    if (isDownload) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    } else if (contentType.includes("pdf")) {
      headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  }
}
