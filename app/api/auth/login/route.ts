import { NextResponse } from "next/server";
import {
  applySessionCookie,
  areAuthUsersConfigured,
  authenticateCredentials,
  createSessionToken,
} from "@/lib/backend/sessionAuth";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = consumeRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.ok) {
      const response = NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
      response.headers.set("retry-after", String(limit.retryAfterSeconds));
      return response;
    }

    if (!areAuthUsersConfigured()) {
      return NextResponse.json(
        { error: "Auth users are not configured in environment" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as LoginBody;
    const username = body.username ?? "";
    const password = body.password ?? "";

    if (!username.trim() || !password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400 }
      );
    }

    const user = authenticateCredentials(username, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createSessionToken(user);
    const response = NextResponse.json({
      user: { username: user.username, role: user.role },
    });
    applySessionCookie(response, token);
    return response;
  } catch (error: unknown) {
    console.error("AUTH LOGIN ERROR:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
