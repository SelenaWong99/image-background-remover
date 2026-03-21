import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const DAILY_LIMIT = 3;

// Workers Rate Limiting API binding 类型声明
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
declare const RATE_LIMITER: RateLimit;

export async function POST(req: NextRequest) {
  try {
    // 获取客户端 IP
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "unknown";

    // Workers Rate Limiting API 限流检查
    try {
      const { success } = await RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return NextResponse.json(
          {
            error: "Daily limit reached",
            message: `You've used all ${DAILY_LIMIT} free uses for today. Come back tomorrow!`,
            remaining: 0,
            total: DAILY_LIMIT,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": String(DAILY_LIMIT),
              "X-RateLimit-Remaining": "0",
              "Retry-After": "86400",
            },
          }
        );
      }
    } catch {
      // Rate Limiter 不可用时放行（本地开发环境）
      console.warn("Rate limiter unavailable, skipping check");
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // 格式校验
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported format. Please upload PNG, JPG, or WEBP." },
        { status: 400 }
      );
    }

    // 大小校验 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service not configured." }, { status: 500 });
    }

    // 调用 remove.bg
    const rbForm = new FormData();
    rbForm.append("image_file", file);
    rbForm.append("size", "auto");

    const rbRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: rbForm,
    });

    if (!rbRes.ok) {
      const errData = await rbRes.json().catch(() => ({}));
      const msg = (errData as any)?.errors?.[0]?.title ?? "Background removal failed.";
      return NextResponse.json({ error: msg }, { status: rbRes.status });
    }

    const imageBuffer = await rbRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="removed-bg.png"',
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(DAILY_LIMIT),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
