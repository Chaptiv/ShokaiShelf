// src/pages/Settings_Discord.tsx
// Discord Rich Presence Settings - Dream Style

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MdVideogameAsset, MdCheck, MdClose, MdRefresh } from "react-icons/md";
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
}> = ({ title, children, accentColor = DREAM.colors.secondaryAccent, delay = 0 }) => (
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
          ? `linear-gradient(135deg, ${DREAM.colors.secondaryAccent}, #7c3aed)`
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

// ============================================================================
// TYPES
// ============================================================================

declare global {
  interface Window {
    shokai?: {
      discord?: {
        getStatus: () => Promise<{ enabled: boolean; connected: boolean; currentActivity: any }>;
        setEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
        setActivity: (activity: any) => Promise<{ success: boolean }>;
        clearActivity: () => Promise<{ success: boolean }>;
      };
    };
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Settings_Discord() {
  const { t } = useTranslation();

  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadStatus() {
    try {
      const status = await (window as any).shokai?.discord?.getStatus();
      if (status) {
        setEnabled(status.enabled);
        setConnected(status.connected);
        setCurrentActivity(status.currentActivity);
      }
    } catch (e) {
      logError("[Discord Settings] Load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function toggleEnabled() {
    try {
      const result = await (window as any).shokai?.discord?.setEnabled(!enabled);
      if (result?.success) {
        setEnabled(result.enabled);
        await loadStatus();
      }
    } catch (e) {
      logError("[Discord] Toggle failed:", e);
    }
  }

  async function clearPresence() {
    try {
      await (window as any).shokai?.discord?.clearActivity();
      await loadStatus();
    } catch (e) {
      logError("[Discord] Clear failed:", e);
    }
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
          <MdVideogameAsset size={32} color={DREAM.colors.secondaryAccent} />
          Discord Rich Presence
        </h1>
        <div style={{ color: DREAM.colors.textMuted }}>
          {t('settings.discord.subtitle')}
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
          background: connected && enabled
            ? `linear-gradient(135deg, ${DREAM.colors.success}10 0%, transparent 100%)`
            : "rgba(255,255,255,0.02)",
          border: `1px solid ${connected && enabled ? `${DREAM.colors.success}30` : DREAM.colors.borderLight}`,
          borderRadius: 12,
        }}
      >
        <motion.div
          animate={{
            boxShadow: connected && enabled ? `0 0 12px ${DREAM.colors.success}` : "none",
          }}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: connected && enabled ? DREAM.colors.success : "rgba(255,255,255,0.3)",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {connected && enabled
            ? t("settings.discord.enableRPC") // Reusing for consistency or new key? "Connected"
            : enabled
              ? t("settings.scrobbler.inactive") // "Discord not found" - maybe need specific key?
              : t("settings.discord.disabled")}
        </span>
      </motion.div>

      {/* Enable Toggle */}
      <SettingsCard delay={0.1}>
        <DreamToggle
          checked={enabled}
          onChange={toggleEnabled}
          label={t("settings.discord.enableRPC")}
          description={t("settings.discord.rpcDesc")}
        />
      </SettingsCard>

      {/* Current Activity */}
      {enabled && currentActivity && (
        <SettingsCard title={t("settings.discord.currentActivity")} accentColor={DREAM.colors.secondaryAccent} delay={0.15}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: DREAM.colors.textMuted, marginBottom: 4 }}>
                {t('settings.discord.titleLabel')}:
              </div>
              <div style={{ fontWeight: 600 }}>{currentActivity.title}</div>
            </div>
            {currentActivity.episode && (
              <div>
                <div style={{ fontSize: 14, color: DREAM.colors.textMuted, marginBottom: 4 }}>
                  {t('media.episode')}:
                </div>
                <div style={{ fontWeight: 600 }}>Episode {currentActivity.episode}</div>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={clearPresence}
              style={{
                marginTop: 8,
                padding: "10px 16px",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${DREAM.colors.borderLight}`,
                borderRadius: 10,
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <MdClose size={16} />
              {t("settings.discord.deleteActivity")}
            </motion.button>
          </div>
        </SettingsCard>
      )}

      {/* Info */}
      <SettingsCard delay={0.2}>
        <div style={{ fontSize: 14, color: DREAM.colors.textMuted, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <MdCheck size={18} color={DREAM.colors.success} />
            <span>{t('settings.discord.requiresRunning')}</span>
          </div>
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <MdCheck size={18} color={DREAM.colors.success} />
            <span>{t('settings.discord.autoUpdates')}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MdCheck size={18} color={DREAM.colors.success} />
            <span>{t('settings.discord.othersCanSee')}</span>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
