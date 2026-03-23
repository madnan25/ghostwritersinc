import { Suspense } from "react";
import { LoginClient } from "./_components/login-client";

function LoginSkeleton() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px 40px",
        background: "#040705",
      }}
    >
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Kicker skeleton */}
        <div
          style={{
            height: "10px",
            width: "100px",
            borderRadius: "4px",
            background: "rgba(191,198,177,0.08)",
            marginBottom: "20px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Heading skeleton */}
        <div
          style={{
            height: "52px",
            width: "80%",
            borderRadius: "8px",
            background: "rgba(191,198,177,0.08)",
            marginBottom: "12px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: "28px",
            width: "55%",
            borderRadius: "6px",
            background: "rgba(191,198,177,0.06)",
            marginBottom: "14px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Subtitle skeleton */}
        <div
          style={{
            height: "14px",
            width: "90%",
            borderRadius: "4px",
            background: "rgba(191,198,177,0.05)",
            marginBottom: "36px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Card skeleton */}
        <div
          style={{
            background: "#0f1410",
            border: "1px solid rgba(191,198,177,0.14)",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <div
            style={{
              height: "14px",
              width: "85%",
              borderRadius: "4px",
              background: "rgba(191,198,177,0.07)",
              marginBottom: "20px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "46px",
              width: "100%",
              borderRadius: "6px",
              background: "rgba(146,201,54,0.15)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginClient />
    </Suspense>
  );
}
