import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPreferences,
  savePreferences,
  type UserPreferences,
} from "@logic/preferences-store";
import { MdAdd, MdClose } from "react-icons/md";

export default function FineTuningSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = async (genre: string, isFavorite: boolean) => {
    if (!preferences) return;

    const updated = { ...preferences };
    if (isFavorite) {
      if (updated.favoriteGenres.includes(genre)) {
        updated.favoriteGenres = updated.favoriteGenres.filter((g) => g !== genre);
      } else {
        updated.favoriteGenres.push(genre);
        updated.dislikedGenres = updated.dislikedGenres.filter((g) => g !== genre);
      }
    } else {
      if (updated.dislikedGenres.includes(genre)) {
        updated.dislikedGenres = updated.dislikedGenres.filter((g) => g !== genre);
      } else {
        updated.dislikedGenres.push(genre);
        updated.favoriteGenres = updated.favoriteGenres.filter((g) => g !== genre);
      }
    }

    setPreferences(updated);
    await savePreferences(updated);
  };

  const POPULAR_GENRES = [
    "Action",
    "Adventure",
    "Comedy",
    "Drama",
    "Fantasy",
    "Romance",
    "Sci-Fi",
    "Slice of Life",
    "Sports",
    "Supernatural",
    "Thriller",
    "Mystery",
    "Horror",
    "Psychological",
    "Mecha",
    "Music",
  ];

  if (loading) {
    return <div style={{ padding: 24 }}>{t("common.loading")}</div>;
  }

  if (!preferences) {
    return <div style={{ padding: 24 }}>{t("common.error")}</div>;
  }

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Info */}
      <div
        style={{
          padding: 16,
          background: "rgba(0, 212, 255, 0.1)",
          border: "1px solid rgba(0, 212, 255, 0.3)",
          borderRadius: 12,
          marginBottom: 32,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          {t("fineTuning.title")}
        </h3>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
          {t("fineTuning.subtitle")}
        </p>
      </div>

      {/* Favorite Genres */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
          {t("fineTuning.favoriteGenres")}
        </h2>
        <p style={{ opacity: 0.6, marginBottom: 20, fontSize: 14 }}>
          {t("fineTuning.favoriteGenresSubtitle")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {POPULAR_GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre, true)}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: preferences.favoriteGenres.includes(genre)
                  ? "2px solid #00d4ff"
                  : "2px solid rgba(255,255,255,0.15)",
                background: preferences.favoriteGenres.includes(genre)
                  ? "rgba(0, 212, 255, 0.2)"
                  : "rgba(255,255,255,0.05)",
                color: preferences.favoriteGenres.includes(genre) ? "#00d4ff" : "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Disliked Genres */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
          {t("fineTuning.dislikedGenres")}
        </h2>
        <p style={{ opacity: 0.6, marginBottom: 20, fontSize: 14 }}>
          {t("fineTuning.dislikedGenresSubtitle")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {POPULAR_GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre, false)}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: preferences.dislikedGenres.includes(genre)
                  ? "2px solid #ff6b6b"
                  : "2px solid rgba(255,255,255,0.15)",
                background: preferences.dislikedGenres.includes(genre)
                  ? "rgba(255, 107, 107, 0.2)"
                  : "rgba(255,255,255,0.05)",
                color: preferences.dislikedGenres.includes(genre) ? "#ff6b6b" : "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          padding: 20,
          background: "rgba(255,255,255,0.03)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          {t("fineTuning.summary")}
        </h3>
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{preferences.favoriteGenres.length}</strong> {t("fineTuning.favoriteGenresCount")}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>{preferences.dislikedGenres.length}</strong> {t("fineTuning.dislikedGenresCount")}
          </div>
          <div>
            <strong>{preferences.selectedAnimeIds.length}</strong> {t("fineTuning.selectedAnimeCount")}
          </div>
        </div>
      </div>
    </div>
  );
}
