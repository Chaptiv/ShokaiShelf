import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose, MdArrowForward, MdCheck } from "react-icons/md";
import { savePreferences, completeColdStart } from "@logic/preferences-store";
import { searchAnime } from "@logic/netrecV3";
import type { Media } from "@api/anilist";
import tokens from "@shingen/tokens";
import { useTranslation } from "react-i18next";

const accentColor = (tokens as any)?.colors?.accent ?? "#00d4ff";

// Popular genres for selection
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

// Popular tags
const POPULAR_TAGS = [
  "School",
  "Isekai",
  "Magic",
  "Seinen",
  "Shounen",
  "Shoujo",
  "Martial Arts",
  "Super Power",
  "Historical",
  "Military",
  "Time Travel",
  "Vampire",
  "Demon",
];

interface ColdStartWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function ColdStartWizard({ onComplete, onSkip }: ColdStartWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);

  // Search anime
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await searchAnime(searchQuery);
      setSearchResults(results as any[]);
    } catch (error) {
      console.error("[ColdStart] Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(handleSearch, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleComplete = async () => {
    // Save preferences
    await savePreferences({
      favoriteGenres: selectedGenres,
      dislikedGenres: dislikedGenres,
      preferredTags: selectedTags,
      selectedAnimeIds: selectedAnime,
    });

    // Mark cold start as completed
    await completeColdStart();

    onComplete();
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleDislikedGenre = (genre: string) => {
    setDislikedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleAnime = (animeId: number) => {
    setSelectedAnime((prev) =>
      prev.includes(animeId) ? prev.filter((id) => id !== animeId) : [...prev, animeId]
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.95)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        style={{
          maxWidth: 900,
          width: "100%",
          maxHeight: "90vh",
          background: "#111",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              {t("coldStart.title")}
            </h2>
            <p style={{ margin: "8px 0 0", opacity: 0.6, fontSize: 14 }}>
              {t("coldStart.subtitle", { step })}
            </p>
          </div>
          <button
            onClick={onSkip}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              padding: "8px 16px",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t("coldStart.skip")}
          </button>
        </div>

        {/* Progress */}
        <div
          style={{
            height: 4,
            background: "rgba(255,255,255,0.05)",
            position: "relative",
          }}
        >
          <motion.div
            animate={{ width: `${(step / 3) * 100}%` }}
            style={{
              height: "100%",
              background: accentColor,
              position: "absolute",
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 32,
          }}
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <Step1
                selectedGenres={selectedGenres}
                dislikedGenres={dislikedGenres}
                onToggleGenre={toggleGenre}
                onToggleDisliked={toggleDislikedGenre}
              />
            )}
            {step === 2 && (
              <Step2 selectedTags={selectedTags} onToggleTag={toggleTag} />
            )}
            {step === 3 && (
              <Step3
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                selectedAnime={selectedAnime}
                onToggleAnime={toggleAnime}
                searching={searching}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "24px 32px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                padding: "12px 24px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t("coldStart.back")}
            </button>
          )}
          <button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleComplete();
              }
            }}
            style={{
              padding: "12px 32px",
              borderRadius: 999,
              border: "none",
              background: accentColor,
              color: "#000",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {step < 3 ? t("coldStart.next") : t("coldStart.finish")}
            {step < 3 ? <MdArrowForward size={18} /> : <MdCheck size={18} />}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Step 1: Genre Selection
function Step1({
  selectedGenres,
  dislikedGenres,
  onToggleGenre,
  onToggleDisliked,
}: {
  selectedGenres: string[];
  dislikedGenres: string[];
  onToggleGenre: (genre: string) => void;
  onToggleDisliked: (genre: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        {t("coldStart.genresTitle")}
      </h3>
      <p style={{ opacity: 0.6, marginBottom: 24, fontSize: 14 }}>
        {t("coldStart.genresSubtitle")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        {POPULAR_GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => onToggleGenre(genre)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: selectedGenres.includes(genre)
                ? `2px solid ${accentColor}`
                : "2px solid rgba(255,255,255,0.15)",
              background: selectedGenres.includes(genre)
                ? `${accentColor}22`
                : "rgba(255,255,255,0.05)",
              color: selectedGenres.includes(genre) ? accentColor : "#fff",
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

      <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        {t("coldStart.dislikedTitle")}
      </h3>
      <p style={{ opacity: 0.6, marginBottom: 24, fontSize: 14 }}>
        {t("coldStart.dislikedSubtitle")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {POPULAR_GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => onToggleDisliked(genre)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: dislikedGenres.includes(genre)
                ? "2px solid #ff6b6b"
                : "2px solid rgba(255,255,255,0.15)",
              background: dislikedGenres.includes(genre)
                ? "rgba(255, 107, 107, 0.2)"
                : "rgba(255,255,255,0.05)",
              color: dislikedGenres.includes(genre) ? "#ff6b6b" : "#fff",
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
    </motion.div>
  );
}

// Step 2: Tag Selection
function Step2({
  selectedTags,
  onToggleTag,
}: {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        {t("coldStart.tagsTitle")}
      </h3>
      <p style={{ opacity: 0.6, marginBottom: 24, fontSize: 14 }}>
        {t("coldStart.tagsSubtitle")}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => onToggleTag(tag)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: selectedTags.includes(tag)
                ? `2px solid ${accentColor}`
                : "2px solid rgba(255,255,255,0.15)",
              background: selectedTags.includes(tag)
                ? `${accentColor}22`
                : "rgba(255,255,255,0.05)",
              color: selectedTags.includes(tag) ? accentColor : "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {tag}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// Step 3: Anime Selection
function Step3({
  searchQuery,
  setSearchQuery,
  searchResults,
  selectedAnime,
  onToggleAnime,
  searching,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Media[];
  selectedAnime: number[];
  onToggleAnime: (id: number) => void;
  searching: boolean;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        {t("coldStart.animeTitle")}
      </h3>
      <p style={{ opacity: 0.6, marginBottom: 24, fontSize: 14 }}>
        {t("coldStart.animeSubtitle")}
      </p>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t("coldStart.searchPlaceholder")}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.05)",
          color: "#fff",
          fontSize: 15,
          marginBottom: 24,
        }}
      />

      {searching && (
        <div style={{ textAlign: "center", padding: 32, opacity: 0.6 }}>
          {t("coldStart.searching")}
        </div>
      )}

      {!searching && searchResults.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 16,
          }}
        >
          {searchResults.map((anime) => (
            <div
              key={anime.id}
              onClick={() => onToggleAnime(anime.id)}
              style={{
                cursor: "pointer",
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                border: selectedAnime.includes(anime.id)
                  ? `3px solid ${accentColor}`
                  : "3px solid transparent",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  paddingTop: "140%",
                  background: "rgba(255,255,255,0.05)",
                  position: "relative",
                }}
              >
                {anime.coverImage?.large && (
                  <img
                    src={anime.coverImage.large}
                    alt={anime.title?.english || anime.title?.romaji || ""}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                {selectedAnime.includes(anime.id) && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: accentColor,
                      display: "grid",
                      placeItems: "center",
                      color: "#000",
                    }}
                  >
                    <MdCheck size={18} />
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {anime.title?.english || anime.title?.romaji || "Unknown"}
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && searchQuery && searchResults.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, opacity: 0.6 }}>
          {t("coldStart.noResults")}
        </div>
      )}
    </motion.div>
  );
}
