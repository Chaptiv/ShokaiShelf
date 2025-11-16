// src/pages/Setup.tsx
import React, { useState } from "react";

export default function Setup() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("http://127.0.0.1:43210/callback");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const onSave = async () => {
    setErr("");
    if (!clientId.trim() || !clientSecret.trim()) {
      setErr("Client ID und Client Secret werden benötigt.");
      return;
    }
    await window.shokai.setup.save({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: redirectUri.trim(),
    });
    setSaved(true);
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "radial-gradient(circle at top, #101624 0%, #060912 55%, #060912 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 460,
          background: "rgba(7,10,16,0.65)",
          border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: 18,
          backdropFilter: "blur(8px)",
          boxShadow: "0 20px 55px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 10px 20px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(140deg, #00d4ff 0%, #5a6fff 90%)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 14,
                color: "#04070f",
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>ShokaiShelf Setup</div>
              <div style={{ fontSize: 11, color: "rgba(221,235,255,0.55)" }}>Erstkonfiguration · AniList</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, color: "#fff" }}>
          <p style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
            Gib deine <b>AniList OAuth-Daten</b> ein. Diese bleiben lokal auf diesem Gerät.
          </p>

          <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.7 }}>
            Client ID
          </label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="z. B. 26314"
            style={inputStyle}
          />

          <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.7 }}>
            Client Secret
          </label>
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="geheime Zeichenfolge"
            style={inputStyle}
            type="password"
          />

          <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.7 }}>
            Redirect URI
          </label>
          <input
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            style={inputStyle}
          />

          {err && (
            <div style={{ background: "rgba(255,76,76,0.12)", border: "1px solid rgba(255,76,76,0.3)", borderRadius: 10, padding: "6px 9px", fontSize: 12, marginTop: 8 }}>
              {err}
            </div>
          )}

          {saved ? (
            <div style={{ marginTop: 14, fontSize: 12, color: "#a8ffdb" }}>
              Konfiguration gespeichert.{" "}
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Neu laden
              </button>
            </div>
          ) : (
            <button
              onClick={onSave}
              style={{
                width: "100%",
                marginTop: 16,
                background: "linear-gradient(120deg, #00d4ff 0%, #367fff 100%)",
                border: "none",
                borderRadius: 10,
                padding: "9px 12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Speichern & fortfahren
            </button>
          )}

          <p style={{ marginTop: 14, fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>
            Tipp: Wenn du diese Version öffentlich verteilst, gib deinen eigenen Key hier <b>nicht</b> ein.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(2,4,8,0.35)",
  border: "1px solid rgba(175,214,255,0.08)",
  borderRadius: 8,
  padding: "7px 9px",
  color: "#fff",
  outline: "none",
  margin: "6px 0 14px 0",
  fontSize: 13,
};
