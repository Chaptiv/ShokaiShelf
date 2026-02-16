import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { changeLanguage, getCurrentLanguage } from "../i18n";
import { viewerCached, subscribeAuth } from "@api/anilist";
import {
  MdSettings, MdPerson, MdDashboard,
  MdTune, MdVideocam, MdNotifications,
  MdLanguage, MdCheck, MdVideogameAsset
} from "react-icons/md";
import FineTuningSettings from "@components/FineTuningSettings";
import Settings_Scrobbler from "./Settings_Scrobbler";
import Settings_Notifications from "./Settings_Notifications";
import Settings_Discord from "./Settings_Discord";
import { useSettings } from "../state/SettingsContext";
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
    hover: "0 20px 50px rgba(0,0,0,0.5)",
  },
};

// ============================================================================
// DREAM COMPONENTS
// ============================================================================

interface SettingsCardProps {
  title?: string;
  children: React.ReactNode;
  accentColor?: string;
  delay?: number;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  children,
  accentColor = DREAM.colors.primaryAccent,
  delay = 0
}) => (
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

interface DreamToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

const DreamToggle: React.FC<DreamToggleProps> = ({ checked, onChange, label, description }) => (
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
          ? `linear-gradient(135deg, ${DREAM.colors.primaryAccent}, #0099cc)`
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

interface DreamSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  showValue?: boolean;
}

const DreamSlider: React.FC<DreamSliderProps> = ({
  value, onChange, min, max, step = 1, label, unit = "", showValue = true
}) => (
  <div style={{ padding: "8px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ color: DREAM.colors.textMuted, fontSize: 14 }}>{label}</span>
      {showValue && (
        <span style={{ fontWeight: 700, color: DREAM.colors.primaryAccent }}>
          {value}{unit}
        </span>
      )}
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
        accentColor: DREAM.colors.primaryAccent,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 8,
        height: 6,
        cursor: "pointer",
      }}
    />
  </div>
);

interface DreamSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  description?: string;
}

const DreamSelect: React.FC<DreamSelectProps> = ({ value, onChange, options, label, description }) => (
  <div style={{ display: "grid", gap: 8, padding: "8px 0" }}>
    <div>
      <label style={{ color: "white", fontSize: 14, fontWeight: 600 }}>{label}</label>
      {description && (
        <div style={{ fontSize: 13, color: DREAM.colors.textMuted, marginTop: 2 }}>
          {description}
        </div>
      )}
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "12px 16px",
        background: "rgba(30, 41, 59, 0.9)",
        border: `1px solid ${DREAM.colors.borderLight}`,
        borderRadius: 12,
        color: "white",
        fontSize: 14,
        cursor: "pointer",
        outline: "none",
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ background: "#1e293b" }}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

interface DreamButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "warning" | "danger";
  fullWidth?: boolean;
  disabled?: boolean;
}

const DreamButton: React.FC<DreamButtonProps> = ({
  onClick, children, variant = "secondary", fullWidth = false, disabled = false
}) => {
  const colors = {
    primary: { bg: DREAM.colors.primaryAccent, border: DREAM.colors.primaryAccent },
    secondary: { bg: "rgba(255,255,255,0.05)", border: DREAM.colors.borderLight },
    warning: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)" },
    danger: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)" },
  };

  const textColors = {
    primary: "white",
    secondary: "white",
    warning: DREAM.colors.warning,
    danger: DREAM.colors.danger,
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "12px 20px",
        background: variant === "primary"
          ? `linear-gradient(135deg, ${DREAM.colors.primaryAccent}, #0099cc)`
          : colors[variant].bg,
        border: `1px solid ${colors[variant].border}`,
        borderRadius: 12,
        color: textColors[variant],
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
type TabId = "general" | "account" | "dashboard" | "recommendations" | "scrobbler" | "notifications" | "discord";

interface TabConfig {
  id: TabId;
  labelKey: string;
  Icon: React.ComponentType<{ size: number }>;
  color: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Settings({ onLoggedIn }: { onLoggedIn?: () => void }) {
  const { t, i18n } = useTranslation();
  const { titleLang, setTitleLang } = useSettings();

  const [authed, setAuthed] = useState(false);
  const [me, setMe] = useState<{
    id: number;
    name: string;
    avatar?: { large?: string };
  } | null>(null);
  const [expText, setExpText] = useState<string>("");

  // Settings State
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [heroAutoPlay, setHeroAutoPlay] = useState(true);
  const [heroSpeed, setHeroSpeed] = useState(5);
  const [showScores, setShowScores] = useState(true);
  const [showProgressBars, setShowProgressBars] = useState(true);
  const [currentLang, setCurrentLang] = useState<"de" | "en">(getCurrentLanguage());

  const TABS: TabConfig[] = [
    { id: "general", labelKey: "settings.tabs.general", Icon: MdSettings, color: DREAM.colors.primaryAccent },
    { id: "account", labelKey: "settings.tabs.account", Icon: MdPerson, color: DREAM.colors.primaryAccent },
    { id: "dashboard", labelKey: "settings.tabs.dashboard", Icon: MdDashboard, color: DREAM.colors.primaryAccent },
    { id: "recommendations", labelKey: "settings.tabs.recommendations", Icon: MdTune, color: DREAM.colors.secondaryAccent },
    { id: "scrobbler", labelKey: "settings.tabs.scrobbler", Icon: MdVideocam, color: DREAM.colors.success },
    { id: "discord", labelKey: "settings.tabs.discord", Icon: MdVideogameAsset, color: DREAM.colors.secondaryAccent },
    { id: "notifications", labelKey: "settings.tabs.notifications", Icon: MdNotifications, color: DREAM.colors.warning },
  ];

  async function loadStatus() {
    try {
      const status = await window.shokai?.status?.();
      const cfg = await window.shokai?.store?.get("anilist");
      const token: string | undefined = cfg?.access_token;

      setAuthed(!!token);

      const exp = Number(cfg?.expires_at || 0);
      if (exp > 0) {
        const ms = exp - Date.now();
        setExpText(ms > 0 ? t("settings.account.tokenExpiresIn", { duration: fmtDuration(ms) }) : t("settings.account.tokenExpired"));
      } else {
        setExpText("");
      }

      if (token && status?.loggedIn) {
        const v = await viewerCached();
        setMe(v);
      } else {
        setMe(null);
      }

      const heroAuto = await window.shokai?.store?.get("ui.heroAutoPlay");
      setHeroAutoPlay(heroAuto !== false);

      const heroSpd = await window.shokai?.store?.get("ui.heroSpeed");
      setHeroSpeed(typeof heroSpd === "number" ? heroSpd : 5);

      const scores = await window.shokai?.store?.get("ui.showScores");
      setShowScores(scores !== false);

      const progress = await window.shokai?.store?.get("ui.showProgressBars");
      setShowProgressBars(progress !== false);

    } catch (e) {
      logError("[Settings] Load error:", e);
      setAuthed(false);
      setMe(null);
      setExpText("");
    }
  }

  useEffect(() => {
    void loadStatus();
    const off = subscribeAuth(() => {
      void loadStatus();
      onLoggedIn?.();
    });
    return off;
  }, []);

  // Sync current language with i18n
  useEffect(() => {
    setCurrentLang(getCurrentLanguage());
  }, [i18n.language]);

  async function saveSetting(key: string, value: any) {
    try {
      await window.shokai?.store?.set(key, value);
      localStorage.setItem(key, String(value));
    } catch (e) {
      logError("[Settings] Failed to save:", e);
    }
  }

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang as "de" | "en");
    setCurrentLang(lang as "de" | "en");
  };

  const handleTitleLanguageChange = (lang: string) => {
    setTitleLang(lang as "EN" | "JP" | "DE");
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: DREAM.colors.background,
      color: "white",
    }}>
      {/* ========== SIDEBAR ========== */}
      <div style={{
        width: 220,
        background: "rgba(255,255,255,0.02)",
        borderRight: `1px solid ${DREAM.colors.borderLight}`,
        padding: "24px 0",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "0 20px 24px",
          borderBottom: `1px solid ${DREAM.colors.borderLight}`,
          marginBottom: 16,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 800,
            fontSize: 20,
          }}>
            <MdSettings size={24} color={DREAM.colors.primaryAccent} />
            {t("settings.title")}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ flex: 1, padding: "0 8px" }}>
          {TABS.map((tab, index) => (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: "100%",
                padding: "12px 16px",
                marginBottom: 4,
                background: activeTab === tab.id
                  ? `linear-gradient(135deg, ${tab.color}15 0%, ${tab.color}05 100%)`
                  : "transparent",
                border: "none",
                borderLeft: `3px solid ${activeTab === tab.id ? tab.color : "transparent"}`,
                borderRadius: "0 12px 12px 0",
                color: activeTab === tab.id ? "white" : DREAM.colors.textMuted,
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s",
              }}
            >
              <tab.Icon size={18} />
              {t(tab.labelKey)}
            </motion.button>
          ))}
        </div>

        {/* Version */}
        <div style={{
          padding: "16px 20px",
          borderTop: `1px solid ${DREAM.colors.borderLight}`,
          fontSize: 12,
          color: DREAM.colors.textMuted,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: DREAM.colors.success,
              boxShadow: `0 0 8px ${DREAM.colors.success}`,
            }} />
            {t('settings.engineActive')}
          </div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>v0.4.0</div>
        </div>
      </div>

      {/* ========== CONTENT AREA ========== */}
      <div style={{ flex: 1, padding: 40, maxWidth: 800, overflow: "auto" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {/* General Tab */}
            {activeTab === "general" && (
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <h1 style={{
                    margin: "0 0 8px 0",
                    fontSize: 28,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}>
                    <MdLanguage size={32} color={DREAM.colors.primaryAccent} />
                    {t("settings.general.title")}
                  </h1>
                  <div style={{ color: DREAM.colors.textMuted }}>
                    {t("settings.general.subtitle")}
                  </div>
                </div>

                <SettingsCard title={t("settings.general.language")} delay={0.1}>
                  <DreamSelect
                    value={currentLang}
                    onChange={handleLanguageChange}
                    label={t("settings.general.languageDesc")}
                    options={[
                      { value: "de", label: "Deutsch" },
                      { value: "en", label: "English" },
                    ]}
                  />
                </SettingsCard>

                <SettingsCard title={t("settings.general.titleLanguage")} delay={0.2}>
                  <DreamSelect
                    value={titleLang}
                    onChange={handleTitleLanguageChange}
                    label={t("settings.general.titleLanguageDesc")}
                    options={[
                      { value: "EN", label: t("settings.general.titleLanguageOptions.english") },
                      { value: "JP", label: t("settings.general.titleLanguageOptions.romaji") },
                      { value: "DE", label: t("settings.general.titleLanguageOptions.german") },
                    ]}
                  />
                </SettingsCard>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <h1 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 900 }}>
                    {t("settings.account.title")}
                  </h1>
                  <div style={{ color: DREAM.colors.textMuted }}>
                    {t("settings.account.subtitle")}
                  </div>
                </div>

                <SettingsCard delay={0.1}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    {me?.avatar?.large ? (
                      <img
                        src={me.avatar.large}
                        alt="Avatar"
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          border: `2px solid ${DREAM.colors.primaryAccent}`,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: DREAM.colors.cardBase,
                        border: `2px solid ${DREAM.colors.borderLight}`,
                      }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>
                        {authed ? (me?.name || t("settings.account.loggedIn")) : t("settings.account.notLoggedIn")}
                      </div>
                      <div style={{
                        fontSize: 14,
                        marginTop: 4,
                        color: authed ? DREAM.colors.success : DREAM.colors.textMuted,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        {authed && (
                          <MdCheck size={16} />
                        )}
                        {authed ? (expText || t("settings.account.tokenActive")) : t("settings.account.pleaseConnect")}
                      </div>
                    </div>
                  </div>

                  {!authed ? (
                    <DreamButton
                      variant="primary"
                      fullWidth
                      onClick={async () => {
                        await window.shokai?.auth?.login();
                      }}
                    >
                      {t("settings.account.loginWithAniList")}
                    </DreamButton>
                  ) : (
                    <div style={{ display: "grid", gap: 16 }}>
                      <DreamButton
                        onClick={async () => {
                          try {
                            await window.shokai?.auth?.refresh?.();
                          } catch { }
                          await loadStatus();
                        }}
                      >
                        {t("settings.account.refreshToken")}
                      </DreamButton>

                      <div style={{
                        borderTop: `1px solid ${DREAM.colors.borderLight}`,
                        paddingTop: 16,
                      }}>
                        <div style={{
                          fontSize: 13,
                          color: DREAM.colors.textMuted,
                          marginBottom: 12,
                        }}>
                          {t("settings.account.accountManagement")}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <DreamButton
                            variant="warning"
                            onClick={async () => {
                              if (confirm(t("settings.account.switchAccountConfirm"))) {
                                await window.shokai?.auth?.logout();
                                window.location.reload();
                              }
                            }}
                          >
                            {t("settings.account.switchAccount")}
                          </DreamButton>

                          <DreamButton
                            variant="danger"
                            onClick={async () => {
                              if (confirm(t("settings.account.logoutConfirm"))) {
                                await window.shokai?.auth?.logout();
                                window.location.reload();
                              }
                            }}
                          >
                            {t("settings.account.logout")}
                          </DreamButton>
                        </div>
                      </div>
                    </div>
                  )}
                </SettingsCard>
              </div>
            )}

            {/* Dashboard Tab */}
            {activeTab === "dashboard" && (
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <h1 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 900 }}>
                    {t("settings.dashboard.title")}
                  </h1>
                  <div style={{ color: DREAM.colors.textMuted }}>
                    {t("settings.dashboard.subtitle")}
                  </div>
                </div>

                <SettingsCard title={t("settings.dashboard.heroBanner")} delay={0.1}>
                  <DreamToggle
                    checked={heroAutoPlay}
                    onChange={async (value) => {
                      setHeroAutoPlay(value);
                      await saveSetting("ui.heroAutoPlay", value);
                    }}
                    label={t("settings.dashboard.autoPlayEnabled")}
                  />

                  {heroAutoPlay && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ marginTop: 16 }}
                    >
                      <DreamSlider
                        value={heroSpeed}
                        onChange={async (value) => {
                          setHeroSpeed(value);
                          await saveSetting("ui.heroSpeed", value);
                        }}
                        min={3}
                        max={10}
                        label={t("settings.dashboard.speed")}
                        unit="s"
                      />
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 4,
                        fontSize: 12,
                        color: DREAM.colors.textMuted,
                      }}>
                        <span>{t("settings.dashboard.fast")} (3s)</span>
                        <span>{t("settings.dashboard.slow")} (10s)</span>
                      </div>
                    </motion.div>
                  )}
                </SettingsCard>

                <SettingsCard title={t("settings.dashboard.cards")} delay={0.2}>
                  <DreamToggle
                    checked={showScores}
                    onChange={async (value) => {
                      setShowScores(value);
                      await saveSetting("ui.showScores", value);
                    }}
                    label={t("settings.dashboard.showScores")}
                  />

                  <DreamToggle
                    checked={showProgressBars}
                    onChange={async (value) => {
                      setShowProgressBars(value);
                      await saveSetting("ui.showProgressBars", value);
                    }}
                    label={t("settings.dashboard.showProgressBars")}
                  />
                </SettingsCard>
              </div>
            )}

            {/* Recommendations Tab */}
            {activeTab === "recommendations" && (
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <h1 style={{
                    margin: "0 0 8px 0",
                    fontSize: 28,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}>
                    <MdTune size={32} color={DREAM.colors.secondaryAccent} />
                    {t("settings.recommendations.title")}
                  </h1>
                  <div style={{ color: DREAM.colors.textMuted }}>
                    {t("settings.recommendations.subtitle")}
                  </div>
                </div>

                <FineTuningSettings />

                <SettingsCard
                  title={t("settings.recommendations.engineTitle")}
                  accentColor={DREAM.colors.secondaryAccent}
                  delay={0.2}
                >
                  <div style={{ color: DREAM.colors.textMuted, fontSize: 14, marginBottom: 16 }}>
                    {t("settings.recommendations.engineDesc")}
                  </div>
                  <ul style={{
                    margin: 0,
                    paddingLeft: 20,
                    lineHeight: 1.8,
                    color: DREAM.colors.textMuted,
                    fontSize: 13,
                  }}>
                    <li>{t("settings.recommendations.features.collaborative")}</li>
                    <li>{t("settings.recommendations.features.currentSimilar")}</li>
                    <li>{t("settings.recommendations.features.mmr")}</li>
                    <li>{t("settings.recommendations.features.confidence")}</li>
                    <li style={{ color: DREAM.colors.secondaryAccent }}>
                      {t("settings.recommendations.features.semantic")}
                    </li>
                  </ul>
                </SettingsCard>
              </div>
            )}

            {/* Scrobbler Tab */}
            {activeTab === "scrobbler" && (
              <Settings_Scrobbler />
            )}

            {/* Discord Tab */}
            {activeTab === "discord" && (
              <Settings_Discord />
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <Settings_Notifications />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}
