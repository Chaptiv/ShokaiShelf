/**
 * UpdateBanner – Dream-styled auto-update notification
 *
 * Listens for update events from the main process via the preload bridge
 * and shows a non-intrusive floating banner when an update is available.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "ready"
    | "error";

interface UpdateInfo {
    status: UpdateStatus;
    version?: string;
    progress?: number;
    error?: string;
}

export default function UpdateBanner() {
    const { t } = useTranslation();
    const [update, setUpdate] = useState<UpdateInfo>({ status: "idle" });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const api = (window as any).shokai?.updater;
        if (!api) return;

        const unsub = api.onStatus((info: UpdateInfo) => {
            setUpdate(info);
            // Re-show banner if a new update becomes available after dismissal
            if (info.status === "available" || info.status === "ready") {
                setDismissed(false);
            }
        });

        // Check once on mount (after a small delay so the app finishes loading)
        const timer = setTimeout(() => api.checkForUpdate(), 5000);

        return () => {
            clearTimeout(timer);
            if (typeof unsub === "function") unsub();
        };
    }, []);

    const handleInstall = useCallback(() => {
        (window as any).shokai?.updater?.installUpdate();
    }, []);

    const handleDismiss = useCallback(() => {
        setDismissed(true);
    }, []);

    // Only show for actionable states
    const visible =
        !dismissed &&
        ["available", "downloading", "ready", "error"].includes(update.status);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={styles.banner}
                >
                    {/* Glow effect */}
                    <div style={styles.glow} />

                    <div style={styles.content}>
                        {/* Status icon */}
                        <div style={styles.iconWrap}>
                            {update.status === "downloading" ? (
                                <SpinnerIcon />
                            ) : update.status === "ready" ? (
                                <CheckIcon />
                            ) : update.status === "error" ? (
                                <ErrorIcon />
                            ) : (
                                <UpdateIcon />
                            )}
                        </div>

                        {/* Text */}
                        <div style={styles.textWrap}>
                            <span style={styles.title}>
                                {update.status === "available" &&
                                    t("updater.available", { version: update.version || "?" })}
                                {update.status === "downloading" &&
                                    t("updater.downloading", {
                                        progress: Math.round(update.progress ?? 0),
                                    })}
                                {update.status === "ready" && t("updater.ready")}
                                {update.status === "error" && t("updater.error")}
                            </span>
                        </div>

                        {/* Actions */}
                        <div style={styles.actions}>
                            {update.status === "downloading" && update.progress != null && (
                                <div style={styles.progressBarOuter}>
                                    <div
                                        style={{
                                            ...styles.progressBarInner,
                                            width: `${Math.round(update.progress)}%`,
                                        }}
                                    />
                                </div>
                            )}

                            {update.status === "ready" && (
                                <button onClick={handleInstall} style={styles.installBtn}>
                                    {t("updater.restart")}
                                </button>
                            )}

                            {update.status !== "downloading" && (
                                <button onClick={handleDismiss} style={styles.dismissBtn}>
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* ───────── Inline icons ───────── */

function UpdateIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

function SpinnerIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
            <path d="M12 2v4">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </path>
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function ErrorIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    );
}

/* ───────── Styles ───────── */

const styles: Record<string, React.CSSProperties> = {
    banner: {
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        background: "rgba(10, 15, 30, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(0, 212, 255, 0.25)",
        borderRadius: 14,
        padding: "10px 18px",
        minWidth: 340,
        maxWidth: 520,
        overflow: "hidden",
    },
    glow: {
        position: "absolute",
        top: -1,
        left: "20%",
        right: "20%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
    },
    content: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    iconWrap: {
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "rgba(0, 212, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    textWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 13,
        fontWeight: 600,
        color: "rgba(255,255,255,0.9)",
        letterSpacing: "0.01em",
    },
    actions: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
    },
    progressBarOuter: {
        width: 80,
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
    },
    progressBarInner: {
        height: "100%",
        borderRadius: 2,
        background: "linear-gradient(90deg, #00d4ff, #7c3aed)",
        transition: "width 0.3s ease",
    },
    installBtn: {
        background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
    },
    dismissBtn: {
        background: "none",
        border: "none",
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: 6,
        lineHeight: 1,
    },
};
