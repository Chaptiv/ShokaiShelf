import React, { useState } from "react";
import { saveTextActivity } from "@api/anilist";
import tokens from "@shingen/tokens";
import { MdSend, MdFormatBold, MdFormatItalic, MdLink, MdPreview } from "react-icons/md";
import { escapeForPreview } from "../utils/sanitize";
import { useTranslation } from "react-i18next";

export default function ComposerWidget({ onPost }: { onPost: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  async function handleSend() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await saveTextActivity(text);
      setText("");
      onPost();
    } catch (e) {
      alert(t("composer.error") + " " + e);
    } finally {
      setLoading(false);
    }
  }

  function insert(chars: string) {
    setText((prev) => prev + chars);
  }

  return (
    <div
      style={{
        padding: 16,
        background: tokens.colors.glass,
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        border: `1px solid ${tokens.colors.glassBorder}`,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <img
          src="https://s4.anilist.co/file/anilistcdn/user/avatar/medium/default.png" // Platzhalter oder echter Avatar
          style={{ width: 40, height: 40, borderRadius: "50%" }}
        />
        <div style={{ flex: 1 }}>
          {!preview ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("composer.placeholder")}
              rows={3}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.2)",
                border: "none",
                borderRadius: 8,
                padding: 12,
                color: "#fff",
                fontSize: 14,
                resize: "vertical",
                minHeight: 80,
                outline: "none",
              }}
            />
          ) : (
            <div
              style={{
                minHeight: 80,
                padding: 12,
                fontSize: 14,
                opacity: 0.8,
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={{ __html: escapeForPreview(text) }}
            />
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <ToolBtn icon={<MdFormatBold />} onClick={() => insert("__bold__")} />
          <ToolBtn icon={<MdFormatItalic />} onClick={() => insert("*italic*")} />
          <ToolBtn icon={<MdLink />} onClick={() => insert("[Link](url)")} />
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
          <ToolBtn
            icon={<MdPreview color={preview ? tokens.colors.accent : undefined} />}
            onClick={() => setPreview(!preview)}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !text.trim()}
          style={{
            padding: "8px 20px",
            background: tokens.colors.accent,
            border: "none",
            borderRadius: 8,
            color: "#000",
            fontWeight: 700,
            cursor: loading || !text.trim() ? "not-allowed" : "pointer",
            opacity: loading || !text.trim() ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {loading ? t("composer.sending") : t("composer.post")} <MdSend />
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 6,
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.6)",
        cursor: "pointer",
        borderRadius: 4,
        fontSize: 18,
      }}
    >
      {icon}
    </button>
  );
}