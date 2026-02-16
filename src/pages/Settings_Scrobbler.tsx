// src/pages/Settings_Scrobbler.tsx
// Scrobbler Settings UI - Dream Style

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MdDelete, MdRefresh, MdVideocam, MdBugReport, MdAdd, MdBlock } from "react-icons/md";
import { devLog, devWarn, logError } from "@utils/logger";


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
}> = ({ title, children, accentColor = DREAM.colors.success, delay = 0 }) => (
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
          ? `linear-gradient(135deg, ${DREAM.colors.success}, #16a34a)`
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
}> = ({ value, onChange, min, max, step = 1, label, unit = "" }) => (
  <div style={{ padding: "8px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ color: DREAM.colors.textMuted, fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 700, color: DREAM.colors.success }}>
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
        accentColor: DREAM.colors.success,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 8,
        height: 6,
        cursor: "pointer",
      }}
    />
  </div>
);

const DreamInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  description?: string;
}> = ({ value, onChange, placeholder, label, description }) => (
  <div style={{ padding: "8px 0" }}>
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{label}</span>
      {description && (
        <div style={{ fontSize: 13, color: DREAM.colors.textMuted, marginTop: 2 }}>
          {description}
        </div>
      )}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: 12,
        border: `1px solid ${DREAM.colors.borderLight}`,
        background: "rgba(30, 41, 59, 0.9)",
        color: "#fff",
        fontSize: 14,
        outline: "none",
      }}
    />
  </div>
);

const DreamButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "purple";
  fullWidth?: boolean;
  disabled?: boolean;
  size?: "small" | "normal";
}> = ({ onClick, children, variant = "secondary", fullWidth = false, disabled = false, size = "normal" }) => {
  const colors = {
    primary: { bg: DREAM.colors.primaryAccent, border: DREAM.colors.primaryAccent, text: "white" },
    secondary: { bg: "rgba(255,255,255,0.05)", border: DREAM.colors.borderLight, text: "white" },
    success: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.3)", text: DREAM.colors.success },
    danger: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)", text: DREAM.colors.danger },
    purple: { bg: "rgba(168, 85, 247, 0.2)", border: "rgba(168, 85, 247, 0.3)", text: "#d8b4fe" },
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={disabled ? undefined : onClick}
      style={{
        padding: size === "small" ? "8px 12px" : "12px 20px",
        background: colors[variant].bg,
        border: `1px solid ${colors[variant].border}`,
        borderRadius: size === "small" ? 8 : 12,
        color: colors[variant].text,
        fontSize: size === "small" ? 12 : 14,
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

interface ScrobblerConfig {
  enabled: boolean;
  pollInterval: number;
  whitelist: string[];
  blacklist: string[];
  smartThreshold: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Settings_Scrobbler() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<ScrobblerConfig>({
    enabled: false,
    pollInterval: 5000,
    whitelist: [],
    blacklist: [],
    smartThreshold: 0.8,
  });
  const [aliases, setAliases] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // Debug State
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const result = await (window as any).shokai?.scrobbler?.getStatus();
      if (result?.success && result.status) {
        setConfig(result.status.config);
        setAliases(result.status.aliases);
        setIsRunning(result.status.isRunning);
      }
    } catch (e) {
      logError('[Scrobbler Settings] Load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function updateConfig(updates: Partial<ScrobblerConfig>) {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    const result = await (window as any).shokai?.scrobbler?.updateConfig(newConfig);
    if (result?.success) {
      await loadStatus();
    }
  }

  async function removeAlias(alias: string) {
    const result = await (window as any).shokai?.scrobbler?.removeAlias(alias);
    if (result?.success) {
      const newAliases = { ...aliases };
      delete newAliases[alias];
      setAliases(newAliases);
    }
  }

  async function runDebug() {
    setDebugLoading(true);
    setDebugResult(null);
    setCountdown(3);

    try {
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      const res = await (window as any).shokai?.scrobbler?.debugMatch();
      setDebugResult(res);
    } catch (e) {
      setDebugResult({ error: String(e) });
    } finally {
      setDebugLoading(false);
      setCountdown(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: DREAM.colors.textMuted }}>
        {t("settings.scrobbler.loading")}
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
          <MdVideocam size={32} color={DREAM.colors.success} />
          {t("settings.scrobbler.title")}
        </h1>
        <div style={{ color: DREAM.colors.textMuted }}>
          {t("settings.scrobbler.subtitle")}
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
          background: isRunning
            ? `linear-gradient(135deg, ${DREAM.colors.success}10 0%, transparent 100%)`
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${isRunning ? `${DREAM.colors.success}30` : DREAM.colors.borderLight}`,
          borderRadius: 12,
        }}
      >
        <motion.div
          animate={{
            boxShadow: isRunning ? `0 0 12px ${DREAM.colors.success}` : "none",
          }}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: isRunning ? DREAM.colors.success : "rgba(255,255,255,0.3)",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {isRunning ? t("settings.scrobbler.active") : t("settings.scrobbler.inactive")}
        </span>
        <motion.button
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          onClick={loadStatus}
          style={{
            marginLeft: "auto",
            padding: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: DREAM.colors.textMuted,
            borderRadius: 8,
          }}
        >
          <MdRefresh size={20} />
        </motion.button>
      </motion.div>

      {/* Enable Toggle */}
      <SettingsCard delay={0.1}>
        <DreamToggle
          checked={config.enabled}
          onChange={(value) => updateConfig({ enabled: value })}
          label={t("settings.scrobbler.enabled")}
          description={t("settings.scrobbler.enabledDesc")}
        />
      </SettingsCard>

      {/* Debug Zone */}
      <SettingsCard
        title={t("settings.scrobbler.debugger")}
        accentColor={DREAM.colors.secondaryAccent}
        delay={0.15}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <MdBugReport size={20} color={DREAM.colors.secondaryAccent} />
          <span style={{ fontSize: 13, color: DREAM.colors.textMuted }}>
            {t("settings.scrobbler.testing")}
          </span>
        </div>

        <DreamButton
          variant="purple"
          fullWidth
          onClick={runDebug}
          disabled={debugLoading}
        >
          {countdown !== null
            ? t("scrobblerDebug.wait", { count: countdown })
            : debugLoading
              ? t("settings.scrobbler.testing")
              : t("settings.scrobbler.testDetection")
          }
        </DreamButton>

        <AnimatePresence>
          {debugResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginTop: 16,
                background: "rgba(0,0,0,0.3)",
                padding: 16,
                borderRadius: 12,
                fontSize: 13,
                fontFamily: "monospace",
                border: `1px solid ${DREAM.colors.borderLight}`,
              }}
            >
              {debugResult.error ? (
                <span style={{ color: DREAM.colors.danger }}>{t("scrobblerDebug.error", { message: debugResult.error })}</span>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: DREAM.colors.textMuted, fontWeight: "bold", marginBottom: 4 }}>{t("scrobblerDebug.window")}</div>
                    <div>{t("scrobblerDebug.app")} <b style={{ color: "#fff" }}>{debugResult.window?.app}</b></div>
                    <div>{t("scrobblerDebug.title")} <span style={{ color: "#fff" }}>{debugResult.window?.title}</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <DreamButton
                      variant="success"
                      size="small"
                      onClick={() => {
                        const appName = debugResult.window?.app;
                        if (appName && !config.whitelist.includes(appName)) {
                          updateConfig({ whitelist: [...config.whitelist, appName] });
                        }
                      }}
                    >
                      <MdAdd size={14} /> Whitelist
                    </DreamButton>
                    <DreamButton
                      variant="danger"
                      size="small"
                      onClick={() => {
                        const appName = debugResult.window?.app;
                        if (appName && !config.blacklist.includes(appName)) {
                          updateConfig({ blacklist: [...config.blacklist, appName] });
                        }
                      }}
                    >
                      <MdBlock size={14} /> Blacklist
                    </DreamButton>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: DREAM.colors.textMuted, fontWeight: "bold", marginBottom: 4 }}>{t("scrobblerDebug.status")}</div>
                    <div>{t("scrobblerDebug.blacklisted")} {debugResult.status?.isBlacklisted
                      ? <span style={{ color: DREAM.colors.danger }}>{t("scrobblerDebug.yes")}</span>
                      : <span style={{ color: DREAM.colors.success }}>{t("scrobblerDebug.no")}</span>}
                    </div>
                    <div>{t("scrobblerDebug.whitelisted")} {debugResult.status?.isWhitelisted
                      ? <span style={{ color: DREAM.colors.success }}>{t("scrobblerDebug.yes")}</span>
                      : <span style={{ color: DREAM.colors.warning }}>{t("scrobblerDebug.no")}</span>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: DREAM.colors.textMuted, fontWeight: "bold", marginBottom: 4 }}>{t("scrobblerDebug.result")}</div>
                    {debugResult.result ? (
                      <div style={{ color: DREAM.colors.success }}>
                        {t("scrobblerDebug.animeDetected", { title: debugResult.result.cleanTitle, episode: debugResult.result.episode })}
                      </div>
                    ) : (
                      <div style={{ color: DREAM.colors.danger }}>{t("scrobblerDebug.noAnimeDetected")}</div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </SettingsCard>

      {/* Settings */}
      <SettingsCard title={t("settings.scrobbler.settingsTitle")} delay={0.2}>
        <DreamSlider
          value={config.pollInterval / 1000}
          onChange={(value) => updateConfig({ pollInterval: value * 1000 })}
          min={3}
          max={30}
          label={t("settings.scrobbler.pollInterval")}
          unit={` ${t("settings.scrobbler.seconds")}`}
        />

        <div style={{ marginTop: 16 }}>
          <DreamSlider
            value={Math.round(config.smartThreshold * 100)}
            onChange={(value) => updateConfig({ smartThreshold: value / 100 })}
            min={50}
            max={100}
            step={5}
            label={t("settings.scrobbler.autoUpdateThreshold")}
            unit="%"
          />
          <div style={{ fontSize: 12, color: DREAM.colors.textMuted, marginTop: 4 }}>
            {t("settings.scrobbler.autoUpdateThresholdDesc")}
          </div>
        </div>
      </SettingsCard>

      {/* Whitelist */}
      <SettingsCard title={t("settings.scrobbler.whitelist")} accentColor={DREAM.colors.success} delay={0.25}>
        <DreamInput
          value={config.whitelist.join(", ")}
          onChange={(value) => updateConfig({
            whitelist: value.split(",").map(s => s.trim()).filter(Boolean)
          })}
          placeholder={t("settings.scrobbler.whitelistPlaceholder")}
          label=""
          description={t("settings.scrobbler.whitelistDesc")}
        />
      </SettingsCard>

      {/* Blacklist */}
      <SettingsCard title={t("settings.scrobbler.blacklist")} accentColor={DREAM.colors.danger} delay={0.3}>
        <DreamInput
          value={config.blacklist.join(", ")}
          onChange={(value) => updateConfig({
            blacklist: value.split(",").map(s => s.trim()).filter(Boolean)
          })}
          placeholder={t("settings.scrobbler.blacklistPlaceholder")}
          label=""
          description={t("settings.scrobbler.blacklistDesc")}
        />
      </SettingsCard>

      {/* Aliases */}
      <SettingsCard title={`${t("settings.scrobbler.learnedAliases")} (${Object.keys(aliases).length})`} delay={0.35}>
        {Object.keys(aliases).length === 0 ? (
          <div style={{ textAlign: "center", padding: 16, color: DREAM.colors.textMuted }}>
            {t("settings.scrobbler.noAliases")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
            {Object.entries(aliases).map(([title, mediaId]) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 10,
                  border: `1px solid ${DREAM.colors.borderLight}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 12, color: DREAM.colors.textMuted, marginTop: 2 }}>
                    Media ID: {mediaId}
                  </div>
                </div>
                <DreamButton
                  variant="danger"
                  size="small"
                  onClick={() => removeAlias(title)}
                >
                  <MdDelete size={16} />
                </DreamButton>
              </motion.div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
