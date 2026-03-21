import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const DAILY_LIMIT = 3;

// Cloudflare KV binding 类型声明
declare const RATE_LIMIT_KV: KVNamespace;

function getTodayKey(ip: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `ratelimit:${ip}:${today}`;
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; total: number }> {
  try {
    const key = getTodayKey(ip);
    const raw = await RATE_LIMIT_KV.get(key);
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= DAILY_LIMIT) {
      return { allowed: false, remaining: 0, total: DAILY_LIMIT };
    }

    // 递增计数，设置 25 小时过期（确保跨天重置）
    await RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 90000 });
    return { allowed: true, remaining: DAILY_LIMIT - count - 1, total: DAILY_LIMIT };
  } catch {
    // KV 不可用时放行（开发环境）
    return { allowed: true, remaining: DAILY_LIMIT - 1, total: DAILY_LIMIT };
  }
}

export async function POST(req: NextRequest) {
  try {
    // 获取客户端 IP
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "unknown";

    // 限流检查
    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.allowed) {
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
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
