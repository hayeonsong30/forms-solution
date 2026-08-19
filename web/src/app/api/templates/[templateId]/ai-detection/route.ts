import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { existingDataKeys, getCurrentVersion, NotFoundError } from "@/lib/template";
import { aiDetectionSchema, defaultConfigForType } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";
import { parseDataUri } from "@/lib/dataUri";
import { formDetectionProvider } from "@/lib/ai/formDetection";
import { GeminiError } from "@/lib/ai/geminiClient";

// PRD_폼솔루션 §7.7.2, §7.7.10: 빈 양식 이미지 → AI 후보 필드 (source=ai, status=suggested).
// 관리자가 검수해서 확정하기 전까지는 일반 필드 목록에 "제안됨"으로만 표시된다.
export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/ai-detection">) {
  const { templateId } = await ctx.params;
  const body = await req.json();
  const parsed = aiDetectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  const image = parseDataUri(parsed.data.imageDataUri);
  if (!image) return Response.json({ error: "INVALID_IMAGE" }, { status: 400 });

  try {
    const { version } = await getCurrentVersion(templateId);
    const promptVersion = process.env.AI_PROMPT_VERSION ?? "form-v1";

    const job = await prisma.aiJob.create({
      data: {
        targetType: "template",
        targetId: templateId,
        jobType: "form_detection",
        status: "processing",
        provider: "gemini",
        model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        promptVersion,
      },
    });

    let candidates;
    try {
      candidates = await formDetectionProvider.detect({ imageBase64: image.data, mimeType: image.mimeType });
    } catch (e) {
      await prisma.aiJob.update({
        where: { id: job.id },
        data: { status: "failed", errorMessage: e instanceof Error ? e.message : String(e) },
      });
      const status = e instanceof GeminiError ? 502 : 500;
      return Response.json({ error: "AI_DETECTION_FAILED", message: e instanceof Error ? e.message : String(e) }, { status });
    }

    const keys = await existingDataKeys(version.id);
    const created = [];
    for (const c of candidates) {
      const base = slugifyDataKey(c.label);
      const dataKey = withUniqueSuffix(base, keys);
      keys.add(dataKey);
      const field = await prisma.field.create({
        data: {
          templateVersionId: version.id,
          pageNo: parsed.data.pageNo,
          label: c.label,
          dataKey,
          type: c.type,
          boxX: c.box.x,
          boxY: c.box.y,
          boxW: c.box.w,
          boxH: c.box.h,
          required: false,
          source: "ai",
          status: "suggested",
          config: defaultConfigForType(c.type) as Prisma.InputJsonValue,
        },
      });
      created.push(field);
    }

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: "completed", responsePayload: candidates as unknown as Prisma.InputJsonValue },
    });

    return Response.json({ jobId: job.id, fields: created }, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
