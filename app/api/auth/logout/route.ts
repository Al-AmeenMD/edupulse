import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );

  response.cookies.set({
    name: "edupulse_token",
    value: "",
    httpOnly: false,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    expires: new Date(0),
  });

  return response;
}

export async function GET() {
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );

  response.cookies.set({
    name: "edupulse_token",
    value: "",
    httpOnly: false,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    expires: new Date(0),
  });

  return response;
}
