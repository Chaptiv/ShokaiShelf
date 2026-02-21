
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import tokens from '@shingen/tokens';
import logo from '../assets/logo.png';
import { MdCheck, MdSearch } from 'react-icons/md';
import { savePreferences, completeColdStart } from '@logic/preferences-store';
import { searchAnime } from '@api/anilist';
import type { Media } from '@api/anilist';
import { devLog, logError } from '@utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Import Icons (moved from App.tsx)
const OnboardingIcons = {
    welcome: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
        </svg>
    ),
    navigate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
            <polygon points="3 11 22 2 13 21 11 13 3 11" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" />
        </svg>
    ),
    brain: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
            <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 7.5 7.8 8.4 8.3 9.1C6.4 9.6 5 11.3 5 13.5C5 15.5 6.2 17.1 7.8 17.7C7.3 18.3 7 19.1 7 20C7 21.7 8.3 23 10 23" stroke="#00d4ff" />
            <path d="M12 2C14.5 2 16.5 4 16.5 6.5C16.5 7.5 16.2 8.4 15.7 9.1C17.6 9.6 19 11.3 19 13.5C19 15.5 17.8 17.1 16.2 17.7C16.7 18.3 17 19.1 17 20C17 21.7 15.7 23 14 23" stroke="#00d4ff" />
            <path d="M12 8V23" stroke="#00d4ff" />
        </svg>
    ),
    box: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
            <path d="M21 8V21H3V8" fill="rgba(0,212,255,0.1)" stroke="#00d4ff" />
            <path d="M23 3H1V8H23V3Z" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
            <path d="M10 12H14" stroke="#00d4ff" />
        </svg>
    ),
    share: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
            <circle cx="18" cy="5" r="3" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
            <circle cx="6" cy="12" r="3" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
            <circle cx="18" cy="19" r="3" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="#00d4ff" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="#00d4ff" />
        </svg>
    ),
};

// Popular genres for selection (from ColdStartWizard)
export const POPULAR_GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi", "Slice of Life",
    "Sports", "Supernatural", "Thriller", "Mystery", "Horror", "Psychological", "Mecha", "Music"
];

// Popular tags (from ColdStartWizard)
export const POPULAR_TAGS = [
    "School", "Isekai", "Magic", "Seinen", "Shounen", "Shoujo", "Martial Arts",
    "Super Power", "Historical", "Military", "Time Travel", "Vampire", "Demon"
];

interface FirstTimeExperienceProps {
    onComplete: () => void;
    initialState: {
        needsSetup: boolean;
        needsLogin: boolean;
        needsColdStart: boolean;
    };
}

export default function FirstTimeExperience({ onComplete, initialState }: FirstTimeExperienceProps) {
    const { t } = useTranslation();

    // State
    const [step, setStep] = useState(0); // 0 = Logo Intro
    const [direction, setDirection] = useState(1);

    // Data State
    const [setupData, setSetupData] = useState({ clientId: '', clientSecret: '', redirectUri: 'http://127.0.0.1:43210/callback' });
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [dislikedGenres, setDislikedGenres] = useState<string[]>([]); // Not exposed in UI for now to keep flow simple, or maybe split genre step?
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedAnime, setSelectedAnime] = useState<number[]>([]);

    // Computed Steps mapping
    // 0: Logo
    // 1: Setup
    // 2: Login
    // 3: Genres
    // 4: Tags
    // 5: Anime
    // 6-10: Tour

    const getNextStep = (current: number, dir: 1 | -1) => {
        let next = current + dir;

        // Skip logic loop (in case multiple steps skipped)
        while (true) {
            let skipped = false;
            if (next === 1 && !initialState.needsSetup) { next += dir; skipped = true; }
            if (next === 2 && !initialState.needsLogin) { next += dir; skipped = true; }
            if ((next >= 3 && next <= 5) && !initialState.needsColdStart) {
                // If cold start not needed, jump over all cold start steps
                next = dir === 1 ? 6 : 2;
                skipped = true;
            }
            if (!skipped) break;
            // Safety break for out of bounds
            if (next < 0 || next > 11) break;
        }

        return next;
    };

    const advance = async () => {
        // Save data based on step leaving
        if (step === 3 || step === 4 || step === 5) {
            // Save preferences incrementally or at end of step 5
            if (step === 5) {
                await savePreferences({
                    favoriteGenres: selectedGenres,
                    dislikedGenres: [],
                    preferredTags: selectedTags,
                    selectedAnimeIds: selectedAnime,
                });
                await completeColdStart();
            }
        }

        const next = getNextStep(step, 1);
        if (next > 10) {
            onComplete();
        } else {
            setDirection(1);
            setStep(next);
        }
    };

    const back = () => {
        // Can't go back before start of interactive flow
        // Find first interactive step
        let startStep = 1;
        if (!initialState.needsSetup) startStep = 2;
        if (!initialState.needsSetup && !initialState.needsLogin) startStep = 3;
        if (!initialState.needsSetup && !initialState.needsLogin && !initialState.needsColdStart) startStep = 6;

        if (step <= startStep) return; // Can't go back further

        const prev = getNextStep(step, -1);
        setDirection(-1);
        setStep(prev);
    };

    // Skip specifically for cold start steps
    const skipColdStart = async () => {
        // Mark cold start complete? Or just skip?
        // Usually skip explicitly implies "I don't want to do this now" -> completeColdStart()
        await completeColdStart();
        setDirection(1);
        setStep(6); // Jump to Tour
    };

    // Logo Intro Logic
    useEffect(() => {
        if (step === 0) {
            const timer = setTimeout(() => {
                advance();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [step]);

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'radial-gradient(circle at 60% -20%, #1e293b 0%, #020617 60%, #000000 100%)',
            color: '#fff', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, sans-serif'
        }}>
            <AnimatePresence mode="wait" custom={direction}>
                {step === 0 && <LogoIntro key="step-0" />}
                {step > 0 && (
                    <motion.div
                        key="container"
                        initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                    >
                        <div style={{
                            width: '100%', maxWidth: '900px', height: '85vh', maxHeight: '700px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            backdropFilter: 'blur(24px)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '24px',
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)'
                        }}>
                            {/* Progress Bar */}
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', position: 'relative' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(step / 10) * 100}%` }}
                                    transition={{ duration: 0.5 }}
                                    style={{ height: '100%', background: '#00d4ff', boxShadow: '0 0 10px rgba(0,212,255,0.5)' }}
                                />
                            </div>

                            {/* Main Content */}
                            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                                <AnimatePresence mode="wait" custom={direction}>
                                    <motion.div
                                        key={step}
                                        custom={direction}
                                        initial={{ opacity: 0, x: direction * 50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: direction * -50 }}
                                        transition={{ duration: 0.3 }}
                                        style={{ width: '100%', height: '100%', overflowY: 'auto' }}
                                    >
                                        {step === 1 && <SetupStep data={setupData} setData={setSetupData} onNext={advance} t={t} />}
                                        {step === 2 && <LoginStep onNext={advance} t={t} />}
                                        {step === 3 && <GenreStep selected={selectedGenres} setSelected={setSelectedGenres} onNext={advance} onBack={back} onSkip={skipColdStart} t={t} />}
                                        {step === 4 && <TagStep selected={selectedTags} setSelected={setSelectedTags} onNext={advance} onBack={back} onSkip={skipColdStart} t={t} />}
                                        {step === 5 && <AnimeStep selected={selectedAnime} setSelected={setSelectedAnime} onNext={advance} onBack={back} onSkip={skipColdStart} t={t} />}
                                        {step >= 6 && step <= 10 && <TourStep stepIndex={step - 6} onNext={advance} onBack={back} t={t} />}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP STEP
// ─────────────────────────────────────────────────────────────────────────────
function SetupStep({ data, setData, onNext, t }: any) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!data.clientId || !data.clientSecret) {
            setError(t('setup.credentialsRequired'));
            return;
        }
        setSaving(true);
        try {
            await (window as any).shokai.setup.save({
                client_id: data.clientId,
                client_secret: data.clientSecret,
                redirect_uri: data.redirectUri
            });
            onNext();
        } catch (e: any) {
            setError(e.message || 'Error saving credentials');
        } finally {
            setSaving(false);
        }
    };

    return (
        <CenteredLayout title={t('setup.title')} subtitle={t('setup.subtitle')}>
            <div style={{ width: '100%', maxWidth: 400 }}>
                <Input label={t('setup.clientId')} value={data.clientId} onChange={(e: any) => setData({ ...data, clientId: e.target.value })} placeholder="1234" />
                <div style={{ height: 16 }} />
                <Input label={t('setup.clientSecret')} value={data.clientSecret} onChange={(e: any) => setData({ ...data, clientSecret: e.target.value })} type="password" placeholder="...secret..." />

                {error && <div style={{ color: '#ff6b6b', marginTop: 16, fontSize: 13, textAlign: 'center' }}>{error}</div>}

                <div style={{ marginTop: 32 }}>
                    <Button onClick={handleSave} loading={saving} fluid primary>{t('setup.saveAndContinue')}</Button>
                </div>
            </div>
        </CenteredLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN STEP
// ─────────────────────────────────────────────────────────────────────────────
function LoginStep({ onNext, t }: any) {
    const [waiting, setWaiting] = useState(false);

    const handleLogin = async () => {
        setWaiting(true);
        // Start login flow
        (window as any).shokai.auth.login();
    };

    // Listen for auth updates
    useEffect(() => {
        if (!waiting) return;

        const off = (window as any).shokai.auth.onUpdated(async () => {
            const status = await (window as any).shokai.status();
            if (status.loggedIn) {
                onNext();
            }
        });
        return () => off && off();
    }, [waiting, onNext]);

    return (
        <CenteredLayout title={t('login.connectTitle')} subtitle={t('login.connectDescription')}>
            <div style={{ textAlign: 'center' }}>
                {!waiting ? (
                    <Button onClick={handleLogin} primary size="large">
                        {t('login.signIn')}
                    </Button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div className="spinner" style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span style={{ opacity: 0.6 }}>{t('ftue.waitingForAuth')}</span>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        <button onClick={() => setWaiting(false)} style={{ background: 'transparent', border: 'none', color: '#00d4ff', marginTop: 16, cursor: 'pointer', textDecoration: 'underline' }}>
                            {t('login.checkAgain')}
                        </button>
                    </div>
                )}
            </div>
        </CenteredLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// GENRE STEP
// ─────────────────────────────────────────────────────────────────────────────
function GenreStep({ selected, setSelected, onNext, onBack, onSkip, t }: any) {
    const toggle = (g: string) => {
        if (selected.includes(g)) setSelected(selected.filter((x: string) => x !== g));
        else setSelected([...selected, g]);
    };

    return (
        <FlowLayout
            title={t('ftue.selectGenres')}
            subtitle={t('ftue.selectGenresSub')}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
            canProceed={selected.length >= 1} // Relaxed constraint for testing
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {POPULAR_GENRES.map(g => (
                    <SelectionChip key={g} label={g} selected={selected.includes(g)} onClick={() => toggle(g)} />
                ))}
            </div>
        </FlowLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG STEP
// ─────────────────────────────────────────────────────────────────────────────
function TagStep({ selected, setSelected, onNext, onBack, onSkip, t }: any) {
    const toggle = (tag: string) => {
        if (selected.includes(tag)) setSelected(selected.filter((x: string) => x !== tag));
        else setSelected([...selected, tag]);
    };

    return (
        <FlowLayout
            title={t('ftue.selectTags')}
            subtitle={t('ftue.selectTagsSub')}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
            canProceed={true}
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {POPULAR_TAGS.map(tag => (
                    <SelectionChip key={tag} label={tag} selected={selected.includes(tag)} onClick={() => toggle(tag)} />
                ))}
            </div>
        </FlowLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIME STEP
// ─────────────────────────────────────────────────────────────────────────────
function AnimeStep({ selected, setSelected, onNext, onBack, onSkip, t }: any) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Media[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (query.length > 2) {
            const timer = setTimeout(async () => {
                setSearching(true);
                try {
                    const res = await searchAnime(query);
                    setResults(res);
                } catch (e) { logError(e); }
                finally { setSearching(false); }
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setResults([]);
        }
    }, [query]);

    const toggle = (id: number) => {
        if (selected.includes(id)) setSelected(selected.filter((x: number) => x !== id));
        else setSelected([...selected, id]);
    };

    return (
        <FlowLayout
            title={t('ftue.selectAnime')}
            subtitle={t('ftue.selectAnimeSub')}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
            canProceed={true}
        >
            <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', marginBottom: 20 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MdSearch style={{ position: 'absolute', left: 12, color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('ftue.searchPlaceholder')}
                        style={{
                            width: '100%', padding: '12px 12px 12px 42px',
                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12, color: '#fff', fontSize: 16, outline: 'none'
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 16, width: '100%' }}>
                {results.map(anime => (
                    <AnimeCard
                        key={anime.id}
                        media={anime}
                        selected={selected.includes(anime.id)}
                        onClick={() => toggle(anime.id)}
                    />
                ))}
            </div>

            {results.length === 0 && selected.length > 0 && <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 40 }}>{selected.length} Selected</div>}
        </FlowLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOUR STEP
// ─────────────────────────────────────────────────────────────────────────────
function TourStep({ stepIndex, onNext, onBack, t }: any) {
    const steps = [
        {
            title: t('onboarding.welcome'),
            subtitle: t('onboarding.welcomeSubtitle'),
            body: t('onboarding.welcomeBody'),
            icon: OnboardingIcons.welcome,
        },
        {
            title: t('onboarding.navigation'),
            subtitle: t('onboarding.navigationSubtitle'),
            body: t('onboarding.navigationBody'),
            icon: OnboardingIcons.navigate,
        },
        {
            title: t('onboarding.dreamEngine'),
            subtitle: t('onboarding.dreamEngineSubtitle'),
            body: t('onboarding.dreamEngineBody'),
            icon: OnboardingIcons.brain,
        },
        {
            title: t('onboarding.smartFeatures'),
            subtitle: t('onboarding.smartFeaturesSubtitle'),
            body: t('onboarding.smartFeaturesBody'),
            icon: OnboardingIcons.share,
        },
        {
            title: t('onboarding.ready'),
            subtitle: t('onboarding.readySubtitle'),
            body: t('onboarding.readyBody'),
            icon: OnboardingIcons.box,
            isLast: true
        },
    ];

    const content = steps[stepIndex];

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{ width: 120, height: 120, marginBottom: 32, color: '#00d4ff' }}>
                {content.icon}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px 0' }}>{content.title}</h2>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: '#00d4ff', margin: '0 0 24px 0' }}>{content.subtitle}</h3>
            <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.7, maxWidth: 500, margin: '0 0 48px 0' }}>
                {content.body}
            </p>

            <div style={{ display: 'flex', gap: 16 }}>
                <Button onClick={onBack} secondary>{t('ftue.back')}</Button>
                <Button onClick={onNext} primary>
                    {content.isLast ? t('ftue.finish') : t('ftue.continue')}
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function LogoIntro() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 20, filter: 'blur(30px)' }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
            <motion.img
                src={logo}
                alt="ShokaiShelf"
                initial={{ scale: 0.5, opacity: 0, filter: 'blur(10px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 2, ease: "easeOut" }}
                style={{ width: 140, height: 140, marginBottom: 32, filter: 'drop-shadow(0 0 40px rgba(0, 212, 255, 0.5))' }}
            />
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 1 }}
                style={{ textAlign: 'center' }}
            >
                <h1 style={{ margin: 0, fontSize: 42, fontWeight: 800, letterSpacing: '-1px' }}>ShokaiShelf</h1>
                <p style={{ margin: '12px 0 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 18, letterSpacing: '0.5px' }}>
                    Your personal anime sanctuary
                </p>
            </motion.div>
        </motion.div>
    );
}

function CenteredLayout({ title, subtitle, children }: any) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px 0' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 16, opacity: 0.6, margin: '0 0 32px 0' }}>{subtitle}</p>}
            {children}
        </div>
    );
}

function FlowLayout({ title, subtitle, children, onNext, onBack, onSkip, canProceed }: any) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px 0' }}>{title}</h2>
                {subtitle && <p style={{ fontSize: 16, opacity: 0.6, margin: 0 }}>{subtitle}</p>}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
                {children}
            </div>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    {onBack && <Button onClick={onBack} secondary>Back</Button>}
                    {onSkip && <Button onClick={onSkip} ghost>Skip</Button>}
                </div>
                <Button onClick={onNext} primary disabled={!canProceed}>Continue</Button>
            </div>
        </div>
    );
}

function Input({ label, ...props }: any) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, fontWeight: 600 }}>{label}</label>
            <input
                {...props}
                style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none',
                    transition: 'border-color 0.2s'
                }}
            />
        </div>
    );
}

function Button({ children, primary, secondary, ghost, fluid, onClick, disabled, loading, size }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            style={{
                background: primary ? 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)' : secondary ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: secondary || ghost ? '1px solid rgba(255,255,255,0.1)' : 'none',
                borderColor: ghost ? 'transparent' : undefined,
                color: primary ? '#000' : '#fff',
                padding: size === 'large' ? '14px 32px' : '10px 24px',
                borderRadius: 12,
                cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                width: fluid ? '100%' : 'auto',
                opacity: disabled ? 0.5 : 1,
                transition: 'all 0.2s',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            {loading ? '...' : children}
        </button>
    );
}

function SelectionChip({ label, selected, onClick }: any) {
    return (
        <button
            onClick={onClick}
            style={{
                background: selected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selected ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                color: selected ? '#00d4ff' : 'rgba(255,255,255,0.8)',
                padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                fontSize: 14, fontWeight: selected ? 600 : 400,
                transition: 'all 0.2s'
            }}
        >
            {label}
        </button>
    );
}

function AnimeCard({ media, selected, onClick }: any) {
    return (
        <div
            onClick={onClick}
            style={{
                position: 'relative', aspectRatio: '2/3', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                border: selected ? '3px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s'
            }}
        >
            <img
                src={media.coverImage?.large}
                alt={media.title?.english || "Anime"}
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: selected ? 0.6 : 1 }}
            />
            {selected && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MdCheck size={24} color="#000" />
                    </div>
                </div>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {media.title?.english || media.title?.romaji}
                </div>
            </div>
        </div>
    );
}
