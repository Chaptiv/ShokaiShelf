/**
 * UpdateBanner – Dream-styled auto-update notification
 *
 * Listens for update events from the main process via the preload bridge
 * and shows a non-intrusive floating banner when an update is available.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    releaseNotes?: string | Array<{ version: string; note: string }> | any;
}

export default function UpdateBanner() {
    const { t } = useTranslation();
    const [update, setUpdate] = useState<UpdateInfo>({ status: "idle" });
    const [dismissed, setDismissed] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);

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

    const toggleChangelog = useCallback(() => {
        setShowChangelog(prev => !prev);
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

                            {update.status === "ready" && update.releaseNotes && (
                                <button onClick={toggleChangelog} style={styles.changelogBtn}>
                                    {t("updater.viewChangelog", "What's New")}
                                </button>
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

            {/* Changelog Modal Overlay */}
            {showChangelog && update.releaseNotes && (
                <div style={styles.modalOverlay} onClick={toggleChangelog}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                        style={styles.modalContent}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>
                                {t("updater.changelogTitle", "Release Notes")} (v{update.version})
                            </h2>
                            <button onClick={toggleChangelog} style={styles.modalCloseBtn}>✕</button>
                        </div>
                        <div style={styles.modalBody}>
                            <div style={styles.markdownWrapper}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {typeof update.releaseNotes === "string"
                                        ? update.releaseNotes
                                        // electron-updater sometimes sends releaseNotes as an array of objects
                                        : Array.isArray(update.releaseNotes)
                                            ? update.releaseNotes.map((n: any) => n.note).join('\n\n')
                                            : "No release notes provided."}
                                </ReactMarkdown>
                            </div>
                        </div>
                        <div style={styles.modalFooter}>
                            <button onClick={handleInstall} style={styles.installBtnLarge}>
                                {t("updater.restartToInstall", "Restart & Install Update")}
                            </button>
                        </div>
                    </motion.div>
                </div>
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
    changelogBtn: {
        background: "rgba(0, 212, 255, 0.1)",
        color: "#00d4ff",
        border: "1px solid rgba(0, 212, 255, 0.2)",
        borderRadius: 8,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        transition: "all 0.2s ease",
    },
    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(5, 7, 12, 0.75)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100000, // Above everything
    },
    modalContent: {
        width: "90%",
        maxWidth: 600,
        maxHeight: "85vh",
        background: "#080c14", // Deep dark background
        border: "1px solid rgba(0, 212, 255, 0.2)",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },
    modalHeader: {
        padding: "16px 20px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
    },
    modalTitle: {
        margin: 0,
        fontSize: 16,
        fontWeight: 700,
        color: "#fff",
        background: "linear-gradient(135deg, #fff 0%, #a5b4fc 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
    },
    modalCloseBtn: {
        background: "transparent",
        border: "none",
        color: "rgba(255, 255, 255, 0.4)",
        cursor: "pointer",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
    },
    modalBody: {
        padding: "20px 24px",
        overflowY: "auto",
        flex: 1,
    },
    markdownWrapper: {
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: 14,
        lineHeight: 1.6,
        // Optional nested styling for markdown elements could go here
    },
    modalFooter: {
        padding: "16px 20px",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        display: "flex",
        justifyContent: "flex-end",
        background: "rgba(0,0,0,0.2)",
    },
    installBtnLarge: {
        background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.02em",
        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)",
    }
};

// Add global styles for the Markdown wrapper so it renders lists/headers nicely
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        .markdownWrapper h1, .markdownWrapper h2, .markdownWrapper h3 {
            color: #fff;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
        }
        .markdownWrapper h1:first-child, .markdownWrapper h2:first-child, .markdownWrapper h3:first-child {
            margin-top: 0;
        }
        .markdownWrapper ul, .markdownWrapper ol {
            padding-left: 1.5em;
            margin-bottom: 1em;
        }
        .markdownWrapper li {
            margin-bottom: 0.25em;
        }
        .markdownWrapper code {
            background: rgba(255,255,255,0.1);
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .markdownWrapper pre {
            background: rgba(0,0,0,0.3);
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .markdownWrapper blockquote {
            border-left: 3px solid #00d4ff;
            margin: 0;
            padding-left: 1em;
            color: rgba(255,255,255,0.6);
        }
        .markdownWrapper a {
            color: #00d4ff;
            text-decoration: none;
        }
    `;
    document.head.appendChild(style);
}
