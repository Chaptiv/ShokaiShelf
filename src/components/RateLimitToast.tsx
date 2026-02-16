import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface RateLimitEvent {
  waitMs: number;
  message: string;
}

export default function RateLimitToast() {
  const [event, setEvent] = useState<RateLimitEvent | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<RateLimitEvent>;
      setEvent(customEvent.detail);
      setCountdown(Math.ceil(customEvent.detail.waitMs / 1000));
    };

    window.addEventListener("shokai:rate-limit", handler);
    return () => window.removeEventListener("shokai:rate-limit", handler);
  }, []);

  useEffect(() => {
    if (!event || countdown <= 0) {
      if (countdown <= 0 && event) {
        // Fade out after countdown
        const timer = setTimeout(() => setEvent(null), 1000);
        return () => clearTimeout(timer);
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [event, countdown]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 16,
            padding: "16px 24px",
            boxShadow: "0 8px 32px rgba(255, 107, 107, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 400,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {/* Warning Icon */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Content */}
          <div style={{ flex: 1, color: "#fff" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              AniList Rate Limit Reached
            </div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {countdown > 0 ? (
                <>
                  Waiting <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
                </>
              ) : (
                "Resuming..."
              )}
            </div>
          </div>

          {/* Countdown Circle */}
          {countdown > 0 && (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 20,
                color: "#fff",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  transform: "rotate(-90deg)",
                }}
              >
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="3"
                />
                <motion.circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 1 }}
                  animate={{ pathLength: Math.max(0, countdown / (event.waitMs / 1000)) }}
                  transition={{ duration: 1, ease: "linear" }}
                  style={{
                    pathLength: Math.max(0, countdown / (event.waitMs / 1000)),
                  }}
                />
              </svg>
              {countdown}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
