import { NextResponse } from "next/server";
import { isRestConfigured, getPresignedUpload, uploadToPresigned } from "@/lib/kognitos-rest";
import { AUTOMATION_ID } from "@/lib/kognitos";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 10;

export async function POST(request: Request) {
  if (!isRestConfigured()) {
    return NextResponse.json(
      { error: "File upload not configured. Set KOGNITOS_REST_API_URL and KOGNITOS_API_KEY." },
      { status: 503 }
    );
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }
  const files = formData.getAll("files").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files provided. Use form field 'files' (multiple allowed)." },
      { status: 400 }
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files allowed.` },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File ${f.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit.` },
        { status: 400 }
      );
    }
  }
  const agentId = AUTOMATION_ID ?? undefined;
  const fileIds: string[] = [];
  try {
    for (const file of files) {
      const presigned = await getPresignedUpload(file.name, agentId);
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadToPresigned(
        presigned.upload_url,
        presigned.upload_fields,
        { name: file.name, buffer },
        presigned.file_field
      );
      fileIds.push(presigned.id);
    }
    return NextResponse.json({ file_ids: fileIds });
  } catch (e) {
    console.error("[api/runs/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "File upload failed" },
      { status: 500 }
    );
  }
}
