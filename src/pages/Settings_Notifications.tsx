// src/pages/Settings_Notifications.tsx
// Notifications Settings UI - Dream Style

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MdNotifications, MdRefresh, MdHistory, MdPlayArrow, MdCheck, MdClose } from "react-icons/md";

// ============================================================================
// DREAM DESIGN TOKENS
// ============================================================================
const DREAM = {
  colors: {
    background: "#0f172a",
    cardBase: "#1e293b",
    primaryAccent: "#00d4ff",
    secondaryAccent: "#a855f7",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    borderLight: "rgba(255,255,255,0.1)",
    textMuted: "rgba(255,255,255,0.6)",
  },
  shadows: {
    normal: "0 4px 20px rgba(0,0,0,0.2)",
  },
};

// ============================================================================
// DREAM COMPONENTS
// ============================================================================

const SettingsCard: React.FC<{
  title?: string;
  children: React.ReactNode;
  accentColor?: string;
  delay?: number;
}> = ({ title, children, accentColor = DREAM.colors.warning, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    style={{
      background: `linear-gradient(135deg, ${accentColor}08 0%, transparent 100%)`,
      border: `1px solid ${accentColor}20`,
      borderRadius: 16,
      padding: 24,
      boxShadow: DREAM.shadows.normal,
    }}
  >
    {title && (
      <div style={{
        fontWeight: 800,
        fontSize: 18,
        marginBottom: 16,
        background: `linear-gradient(135deg, ${accentColor}, #fff)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}>
        {title}
      </div>
    )}
    {children}
  </motion.div>
);

const DreamToggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <label style={{
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    cursor: "pointer",
    padding: "8px 0",
  }}>
    <motion.div
      animate={{
        background: checked
          ? `linear-gradient(135deg, ${DREAM.colors.warning}, #d97706)`
          : "rgba(255,255,255,0.1)"
      }}
      transition={{ duration: 0.2 }}
      style={{
        width: 48,
        height: 24,
        borderRadius: 12,
        padding: 2,
        position: "relative",
        flexShrink: 0,
        marginTop: 2,
      }}
      onClick={() => onChange(!checked)}
    >
      <motion.div
        animate={{ x: checked ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          background: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      />
    </motion.div>
    <div>
      <div style={{ fontWeight: 600, color: "white" }}>{label}</div>
      {description && (
        <div style={{ fontSize: 13, color: DREAM.colors.textMuted, marginTop: 2 }}>
          {description}
        </div>
      )}
    </div>
  </label>
);

const DreamSlider: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  description?: string;
}> = ({ value, onChange, min, max, step = 1, label, unit = "", description }) => (
  <div style={{ padding: "8px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ color: DREAM.colors.textMuted, fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 700, color: DREAM.colors.warning }}>
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      min={min}
      max={max}
      step={step}
      style={{
        width: "100%",
        accentColor: DREAM.colors.warning,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 8,
        height: 6,
        cursor: "pointer",
      }}
    />
    {description && (
      <div style={{ fontSize: 12, color: DREAM.colors.textMuted, marginTop: 8 }}>
        {description}
      </div>
    )}
  </div>
);

const DreamButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "warning" | "purple";
  fullWidth?: boolean;
  disabled?: boolean;
}> = ({ onClick, children, variant = "secondary", fullWidth = false, disabled = false }) => {
  const colors = {
    primary: { bg: `linear-gradient(135deg, ${DREAM.colors.warning}, #d97706)`, border: DREAM.colors.warning, text: "white" },
    secondary: { bg: "rgba(255,255,255,0.05)", border: DREAM.colors.borderLight, text: "white" },
    warning: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)", text: DREAM.colors.warning },
    purple: { bg: "rgba(168, 85, 247, 0.1)", border: "rgba(168, 85, 247, 0.3)", text: "#d8b4fe" },
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "12px 20px",
        background: colors[variant].bg,
        border: `1px solid ${colors[variant].border}`,
        borderRadius: 12,
        color: colors[variant].text,
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : "auto",
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {children}
    </motion.button>
  );
};

// ============================================================================
// TYPES
// ============================================================================

interface NotificationConfig {
  enabled: boolean;
  checkInterval: number;
  lookbackWindow: number;
}

interface NotificationHistoryItem {
  id: number;
  mediaId: number;
  episode: number;
  airingAt: number;
  notifiedAt: number;
  userId: string;
  title: string;
}

declare global {
  interface Window {
    shokai?: {
      notifications?: {
        getConfig: () => Promise<{ running: boolean; config: NotificationConfig } | null>;
        updateConfig: (config: Partial<NotificationConfig>) => Promise<{ success: boolean; error?: string }>;
        checkNow: () => Promise<{ success: boolean; error?: string }>;
        getHistory: () => Promise<NotificationHistoryItem[]>;
        test: () => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Settings_Notifications() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<NotificationConfig>({
    enabled: true,
    checkInterval: 30,
    lookbackWindow: 24,
  });
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  async function loadConfig() {
    try {
      const status = await window.shokai?.notifications?.getConfig();
      if (status) {
        setConfig(status.config);
        setRunning(status.running);
      }
    } catch (e) {
      console.error("[Notifications] Load config failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const hist = await window.shokai?.notifications?.getHistory();
      setHistory(hist || []);
    } catch (e) {
      console.error("[Notifications] Load history failed:", e);
    }
  }

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, []);

  async function updateConfig(updates: Partial<NotificationConfig>) {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await window.shokai?.notifications?.updateConfig(updates);
      const status = await window.shokai?.notifications?.getConfig();
      if (status) {
        setRunning(status.running);
      }
    } catch (e) {
      console.error("[Notifications] Update failed:", e);
    }
  }

  async function checkNow() {
    setChecking(true);
    setTestResult(null);
    try {
      const result = await window.shokai?.notifications?.checkNow();
      if (result?.success) {
        setTestResult({ success: true, message: "Check complete!" });
        await loadHistory();
      } else {
        setTestResult({ success: false, message: result?.error || "Check failed" });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "Error" });
    } finally {
      setChecking(false);
    }
  }

  async function testNotification() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.shokai?.notifications?.test();
      if (result?.success) {
        setTestResult({ success: true, message: "Test notification sent!" });
      } else {
        setTestResult({ success: false, message: result?.error || "Test failed" });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "Error" });
    } finally {
      setTesting(false);
    }
  }

  function formatRelativeTime(timestamp: number) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: DREAM.colors.textMuted }}>
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{
          margin: "0 0 8px 0",
          fontSize: 28,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <MdNotifications size={32} color={DREAM.colors.warning} />
          {t("settings.notifications.title")}
        </h1>
        <div style={{ color: DREAM.colors.textMuted }}>
          {t("settings.notifications.subtitle")}
        </div>
      </div>

      {/* Status Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 16,
          background: running
            ? `linear-gradient(135deg, ${DREAM.colors.success}10 0%, transparent 100%)`
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${running ? `${DREAM.colors.success}30` : DREAM.colors.borderLight}`,
          borderRadius: 12,
        }}
      >
        <motion.div
          animate={{
            boxShadow: running ? `0 0 12px ${DREAM.colors.success}` : "none",
          }}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: running ? DREAM.colors.success : "rgba(255,255,255,0.3)",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {running
            ? t("settings.notifications.statusActive", { interval: config.checkInterval })
            : t("settings.notifications.statusInactive")}
        </span>
      </motion.div>

      {/* Enable Toggle */}
      <SettingsCard delay={0.1}>
        <DreamToggle
          checked={config.enabled}
          onChange={(value) => updateConfig({ enabled: value })}
          label={t("settings.notifications.enabled")}
          description={t("settings.notifications.enabledDesc")}
        />
      </SettingsCard>

      {/* Settings */}
      <AnimatePresence>
        {config.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <SettingsCard title="Timing" delay={0.15}>
              <DreamSlider
                value={config.checkInterval}
                onChange={(value) => updateConfig({ checkInterval: value })}
                min={5}
                max={120}
                step={5}
                label={t("settings.notifications.checkInterval")}
                unit={` ${t("settings.notifications.minutes")}`}
              />

              <div style={{ marginTop: 16 }}>
                <DreamSlider
                  value={config.lookbackWindow}
                  onChange={(value) => updateConfig({ lookbackWindow: value })}
                  min={1}
                  max={72}
                  step={1}
                  label={t("settings.notifications.lookbackWindow")}
                  unit={` ${t("settings.notifications.hours")}`}
                  description={t("settings.notifications.lookbackWindowDesc")}
                />
              </div>
            </SettingsCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <SettingsCard title="Actions" accentColor={DREAM.colors.secondaryAccent} delay={0.2}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <DreamButton
            variant="primary"
            onClick={checkNow}
            disabled={checking}
          >
            {checking ? (
              <>
                <MdRefresh size={18} style={{ animation: "spin 1s linear infinite" }} />
                {t("common.loading")}
              </>
            ) : (
              <>
                <MdPlayArrow size={18} />
                {t("settings.notifications.checkNow")}
              </>
            )}
          </DreamButton>

          <DreamButton
            variant="purple"
            onClick={testNotification}
            disabled={testing}
          >
            {testing ? (
              <>
                <MdRefresh size={18} style={{ animation: "spin 1s linear infinite" }} />
                {t("common.loading")}
              </>
            ) : (
              <>
                <MdNotifications size={18} />
                {t("settings.notifications.testNotification")}
              </>
            )}
          </DreamButton>
        </div>

        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 10,
                background: testResult.success
                  ? `${DREAM.colors.success}15`
                  : `${DREAM.colors.danger}15`,
                border: `1px solid ${testResult.success ? DREAM.colors.success : DREAM.colors.danger}30`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {testResult.success ? (
                <MdCheck size={18} style={{ color: DREAM.colors.success }} />
              ) : (
                <MdClose size={18} style={{ color: DREAM.colors.danger }} />
              )}
              <span style={{ color: testResult.success ? DREAM.colors.success : DREAM.colors.danger }}>
                {testResult.message}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </SettingsCard>

      {/* History */}
      <SettingsCard
        title={`${t("settings.notifications.history")} (${history.length})`}
        accentColor={DREAM.colors.primaryAccent}
        delay={0.25}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <MdHistory size={20} color={DREAM.colors.primaryAccent} />
          <DreamButton
            variant="secondary"
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadHistory();
            }}
          >
            {showHistory ? "Hide" : "Show"}
          </DreamButton>
        </div>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ maxHeight: 300, overflowY: "auto" }}
            >
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: DREAM.colors.textMuted }}>
                  {t("settings.notifications.noHistory")}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {history.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{
                        padding: 12,
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: 10,
                        border: `1px solid ${DREAM.colors.borderLight}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {item.title || `Anime #${item.mediaId}`}
                        </div>
                        <div style={{ fontSize: 12, color: DREAM.colors.textMuted }}>
                          Episode {item.episode}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: DREAM.colors.textMuted }}>
                        {formatRelativeTime(item.notifiedAt)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </SettingsCard>

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
