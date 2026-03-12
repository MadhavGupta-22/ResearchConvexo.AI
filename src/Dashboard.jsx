import React, { useState, useRef, useEffect, useCallback } from 'react';
import Dashboard2 from './Dashboard-2';
import './Dashboard.css';
import TransitionAnimation from './TransitionAnimation';

/* ═══════════════════════════════════════════════════════════
   BACKEND API CONFIG
   ═══════════════════════════════════════════════════════════ */

const API_BASE_URL = 'http://localhost:8000';

/* ═══════════════════════════════════════════════════════════
   MAPPING: Frontend UI labels → Backend API enum values
   ═══════════════════════════════════════════════════════════ */

const DEPTH_TO_API = {
    Skim: 'Skim',
    Understand: 'Understand',
    'Deep Dive': 'DeepDive',
};

const TIME_BUDGET_TO_API = {
    quick: 'Quick',
    focused: 'Focused',
    deep: 'DeepResearch',
};

const GOAL_TO_API = {
    learn: 'Learn',
    teach: 'Teach',
    build: 'Learn',
    write: 'Publish',
};

const FORMAT_TO_API = {
    bullets: 'Bullet',
    structured: 'Structured',
    report: 'Report',
};

/* ═══════════════════════════════════════════════════════════
   CONTEXT MODEL
   ═══════════════════════════════════════════════════════════ */

const PERSONAS = [
    { id: 'Learner', label: 'Student / Curious Beginner', icon: 'learner' },
    { id: 'Educator', label: 'Teaching / Explaining', icon: 'educator' },
    { id: 'Researcher', label: 'Academic / Deep Analysis', icon: 'researcher' },
];

const KNOWLEDGE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

const TIME_BUDGETS = [
    { id: 'quick', label: 'Quick Overview', desc: '~5 min read' },
    { id: 'focused', label: 'Focused Study', desc: '15-30 min read' },
    { id: 'deep', label: 'Deep Research', desc: 'Long read' },
];

const END_GOALS = [
    { id: 'learn', label: 'Learn & Understand', icon: null },
    { id: 'teach', label: 'Teach / Explain', icon: null },
    { id: 'build', label: 'Build / Apply', icon: null },
    { id: 'write', label: 'Write / Publish', icon: null },
];

const OUTPUT_FORMATS = [
    { id: 'bullets', label: 'Bullet Summary', icon: null },
    { id: 'structured', label: 'Structured Explanation', icon: null },
    { id: 'report', label: 'Detailed Research Report', icon: null },
];

const DEPTH_STOPS = [
    { value: 0, label: 'Quick surface-level overview' },
    { value: 50, label: 'Balanced depth with key details' },
    { value: 100, label: 'Deep Dive Thorough comprehensive analysis' },
];

/* ═══════════════════════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════════════════════ */

const LearnerIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="role-svg-icon">
        <path d="M20 6L4 14L20 22L36 14L20 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M8 17V27L20 33L32 27V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36 14V26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const EducatorIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="role-svg-icon">
        <rect x="6" y="8" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M14 32H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 28V32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 14H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 18H28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 22H24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const ResearcherIcon = () => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="role-svg-icon">
        <circle cx="17" cy="17" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M24 24L34 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14 14L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 20L20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const PERSONA_ICONS = {
    learner: LearnerIcon,
    educator: EducatorIcon,
    researcher: ResearcherIcon,
};

/* ═══════════════════════════════════════════════════════════
   GENERATE KEYWORDS FOR AGENT
   ═══════════════════════════════════════════════════════════ */

const generateKeywords = (topic, profile) => {
    const keywords = [];
    if (topic) {
        keywords.push(
            ...topic
                .split(/\s+/)
                .filter((w) => w.length > 3)
                .map((w) => w.toLowerCase())
        );
    }
    keywords.push(profile.persona.toLowerCase());
    keywords.push(profile.knowledgeLevel.toLowerCase());
    keywords.push(profile.depthLabel.toLowerCase().replace(' ', '-'));

    const goalKeywords = {
        'Learn & Understand': ['comprehension', 'fundamentals', 'overview'],
        'Teach / Explain': ['pedagogy', 'explanation', 'simplification'],
        'Build / Apply': ['implementation', 'practical', 'application'],
        'Write / Publish': ['academic-writing', 'publication', 'literature-review'],
    };
    if (goalKeywords[profile.endGoal]) {
        keywords.push(...goalKeywords[profile.endGoal]);
    }

    const formatKeywords = {
        'Bullet Summary': ['concise', 'key-points'],
        'Structured Explanation': ['structured', 'step-by-step'],
        'Detailed Research Report': ['comprehensive', 'detailed', 'analytical'],
    };
    if (formatKeywords[profile.outputFormat]) {
        keywords.push(...formatKeywords[profile.outputFormat]);
    }

    const timeKeywords = {
        'Quick Overview': ['brief', 'summary'],
        'Focused Study': ['moderate-depth', 'focused'],
        'Deep Research': ['exhaustive', 'thorough'],
    };
    if (timeKeywords[profile.timeBudget]) {
        keywords.push(...timeKeywords[profile.timeBudget]);
    }

    return [...new Set(keywords)];
};

/* ═══════════════════════════════════════════════════════════
   MY RESEARCH PAGE
   ═══════════════════════════════════════════════════════════ */

const MyResearchPage = ({ onBack }) => {
    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [query, setQuery] = useState('');
    const [analysisType, setAnalysisType] = useState('summary');
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handlePop = () => onBack();
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [onBack]);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) setFile(f);
    };

    const handleFileSelect = (e) => {
        if (e.target.files[0]) setFile(e.target.files[0]);
    };

    return (
        <div className="research-page">
            <div className="research-header">
                <button className="back-btn" onClick={() => window.history.back()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>
                <h1 className="research-title">Work With My Research Paper</h1>
                <p className="research-subtitle">Upload your paper and let AI analyze, summarize, or visualize it</p>
            </div>

            <div className="research-content">
                <div
                    className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !file && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                    {file ? (
                        <div className="file-info">
                            <div className="file-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c6bf0" strokeWidth="1.5">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14,2 14,8 20,8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10,9 9,9 8,9" />
                                </svg>
                            </div>
                            <div className="file-details">
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <button
                                className="remove-file"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="upload-icon">
                                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M24 32V12M24 12L16 20M24 12L32 20" strokeLinecap="round" strokeLinejoin="round" />
                                    <path
                                        d="M8 32V38C8 40.2 9.8 42 12 42H36C38.2 42 40 40.2 40 38V32"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <p className="upload-text">Drop your research paper here</p>
                            <p className="upload-hint">or click to browse — PDF, DOCX, TXT</p>
                        </>
                    )}
                </div>

                <div className="analysis-options">
                    <h3>What would you like to do?</h3>
                    <div className="analysis-grid">
                        {[
                            { id: 'summary', title: 'Generate Summary', desc: 'Concise summary of key findings' },
                            { id: 'visualize', title: 'Visualize Concepts', desc: 'Concept map of relationships' },
                            { id: 'critique', title: 'Critical Analysis', desc: 'Strengths, weaknesses, gaps' },
                            { id: 'citations', title: 'Citation Network', desc: 'Map related research connections' },
                            { id: 'simplify', title: 'Simplify Language', desc: 'Rewrite in plain language' },
                            { id: 'questions', title: 'Generate Questions', desc: 'Discussion or exam questions' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                className={`analysis-card ${analysisType === opt.id ? 'active' : ''}`}
                                onClick={() => setAnalysisType(opt.id)}
                            >
                                <span className="analysis-card-title">{opt.title}</span>
                                <span className="analysis-card-desc">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="custom-query">
                    <h3>Or ask anything about your paper</h3>
                    <div className="query-input-wrap">
                        <input
                            type="text"
                            className="query-input"
                            placeholder="e.g. What are the main limitations of this study?"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button className="query-submit" disabled={!file}>
                            Analyze
                        </button>
                    </div>
                </div>

                <button className="research-submit" disabled={!file}>
                    <span>
                        {file
                            ? `Analyze "${file.name.substring(0, 30)}${file.name.length > 30 ? '...' : ''}"`
                            : 'Upload a paper to begin'}
                    </span>
                </button>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   DISCRETE DEPTH SLIDER
   ═══════════════════════════════════════════════════════════ */

const DiscreteDepthSlider = ({ value, onChange }) => {
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef(null);

    const snapToNearest = (val) => {
        const stops = DEPTH_STOPS.map((s) => s.value);
        let closest = stops[0];
        let minDist = Math.abs(val - stops[0]);
        for (let i = 1; i < stops.length; i++) {
            const dist = Math.abs(val - stops[i]);
            if (dist < minDist) {
                minDist = dist;
                closest = stops[i];
            }
        }
        return closest;
    };

    const getPositionFromEvent = useCallback((e) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return ratio * 100;
    }, []);

    const handlePointerDown = useCallback(
        (e) => {
            e.preventDefault();
            setIsDragging(true);
            const raw = getPositionFromEvent(e);
            onChange(snapToNearest(raw));
        },
        [getPositionFromEvent, onChange]
    );

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e) => {
            const raw = getPositionFromEvent(e);
            onChange(snapToNearest(raw));
        };

        const handleUp = () => setIsDragging(false);

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, getPositionFromEvent, onChange]);

    const currentStop = DEPTH_STOPS.find((s) => s.value === value) || DEPTH_STOPS[0];

    return (
        <div className="depth-slider-container">
            <span className="depth-main-label">Depth</span>
            <div
                className="depth-track-wrap"
                ref={trackRef}
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
            >
                <div className="depth-stops-track">
                    <div className="depth-track-fill" style={{ width: `${value}%` }} />
                </div>

                {DEPTH_STOPS.map((stop) => (
                    <div
                        key={stop.value}
                        className={`depth-stop-dot ${value === stop.value ? 'active' : ''} ${value >= stop.value ? 'filled' : ''}`}
                        style={{ left: `${stop.value}%` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(stop.value);
                        }}
                    />
                ))}

                <div className={`depth-thumb ${isDragging ? 'dragging' : ''}`} style={{ left: `${value}%` }} />
            </div>

            <div className="depth-label-box">
                <div className={`depth-label-display level-${value}`}>
                    <span className="depth-label-text">{currentStop.label}</span>
                    <span className="depth-label-desc">{currentStop.desc}</span>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   KEYWORDS DISPLAY COMPONENT
   ═══════════════════════════════════════════════════════════ */

const KeywordsDisplay = ({ keywords }) => {
    if (!keywords || keywords.length === 0) return null;

    return (
        <div className="keywords-section">
            <div className="keywords-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span className="keywords-title">Agent Keywords</span>
            </div>
            <div className="keywords-list">
                {keywords.map((kw, i) => (
                    <span key={i} className="keyword-tag">
                        {kw}
                    </span>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   DASHBOARD — MAIN COMPONENT (FIXED TRANSITION LOGIC)
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
    const user = { name: 'User', email: 'user@aurora.ai' };
    const [showUserMenu, setShowUserMenu] = useState(false);

    const [searchFocused, setSearchFocused] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [showResearchPage, setShowResearchPage] = useState(false);

    const [analysisResult, setAnalysisResult] = useState(null);
    const [showDashboard2, setShowDashboard2] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState('');

    // ─── Transition state (FIXED) ───
    const [showTransition, setShowTransition] = useState(false);
    const [pendingResult, setPendingResult] = useState(null);
    const [transitionDone, setTransitionDone] = useState(false);

    const [persona, setPersona] = useState('Learner');
    const [knowledgeLevel, setKnowledgeLevel] = useState('Beginner');
    const [timeBudget, setTimeBudget] = useState('quick');
    const [endGoal, setEndGoal] = useState('learn');
    const [outputFormat, setOutputFormat] = useState('bullets');
    const [depthValue, setDepthValue] = useState(0);

    const [papers, setPapers] = useState([]);
    const [loadingPapers, setLoadingPapers] = useState(true);
    const [generatedKeywords, setGeneratedKeywords] = useState([]);

    const searchRef = useRef(null);
    const overlayRef = useRef(null);
    const userMenuRef = useRef(null);

    const depthLabel = depthValue === 0 ? 'Skim' : depthValue === 100 ? 'Deep Dive' : 'Understand';

    const currentProfile = {
        persona,
        knowledgeLevel,
        timeBudget: TIME_BUDGETS.find((t) => t.id === timeBudget)?.label || timeBudget,
        endGoal: END_GOALS.find((g) => g.id === endGoal)?.label || endGoal,
        outputFormat: OUTPUT_FORMATS.find((f) => f.id === outputFormat)?.label || outputFormat,
        depthValue,
        depthLabel,
    };

    useEffect(() => {
        if (searchValue.trim()) {
            const kw = generateKeywords(searchValue, currentProfile);
            setGeneratedKeywords(kw);
        } else {
            setGeneratedKeywords([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue, persona, knowledgeLevel, timeBudget, endGoal, outputFormat, depthValue]);

    const fetchPapers = async (topic = 'CRISPR gene editing') => {
        setLoadingPapers(true);
        try {
            const encoded = encodeURIComponent(topic);
            const res = await fetch(
                `https://api.openalex.org/works?search=${encoded}&sort=publication_date:desc&per_page=5`
            );
            const data = await res.json();
            const formatted = data.results.map((paper) => {
                const venue = paper.primary_location?.source?.display_name || 'Journal';
                const date = new Date(paper.publication_date);
                const now = new Date();
                const diffH = Math.floor((now - date) / 36e5);
                const timeAgo =
                    diffH < 24
                        ? `${diffH}h ago`
                        : diffH < 720
                            ? `${Math.floor(diffH / 24)}d ago`
                            : `${Math.floor(diffH / 720)}mo ago`;
                return {
                    title: `${paper.title} (${venue}, ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`,
                    tag: diffH < 168 ? 'New' : 'Recent',
                    time: timeAgo,
                    url: paper.doi ? `https://doi.org/${paper.doi}` : paper.id,
                };
            });
            setPapers(formatted);
        } catch {
            setPapers([{ title: 'Failed to load papers.', tag: 'Error', time: '', url: '#' }]);
        }
        setLoadingPapers(false);
    };

    useEffect(() => {
        fetchPapers();
    }, []);

    useEffect(() => {
        const h = (e) => {
            if (searchFocused && overlayRef.current && !overlayRef.current.contains(e.target)) {
                setSearchFocused(false);
            }
            if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [searchFocused, showUserMenu]);

    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape') {
                setSearchFocused(false);
                setShowUserMenu(false);
            }
        };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, []);

    useEffect(() => {
        if (searchFocused && searchRef.current) searchRef.current.focus();
    }, [searchFocused]);

    const handleLogout = () => {
        setShowUserMenu(false);
    };

    /* ─────────────────────────────────────────────────────────
       FIX: Navigate to Dashboard2 when BOTH conditions are met:
         1. API result has arrived (pendingResult !== null)
         2. Transition animation has finished (transitionDone === true)
       ───────────────────────────────────────────────────────── */

    useEffect(() => {
        if (pendingResult && transitionDone) {
            // Small delay for smooth visual exit of transition
            const timer = setTimeout(() => {
                setAnalysisResult(pendingResult);
                setShowDashboard2(true);
                // Clean up all transition state
                setShowTransition(false);
                setPendingResult(null);
                setTransitionDone(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [pendingResult, transitionDone]);

    const handleTransitionComplete = useCallback(() => {
        // Just mark that animation is done — the useEffect above
        // handles navigation when both conditions are satisfied
        console.log('[Dashboard] Transition animation complete');
        setTransitionDone(true);
    }, []);
    // No dependencies needed — this just flips a boolean flag

    const handleAnalyze = async () => {
        if (!searchValue.trim()) return;

        const keywords = generateKeywords(searchValue, currentProfile);

        const apiPayload = {
            topic: searchValue.trim(),
            persona: persona,
            depth: DEPTH_TO_API[depthLabel] || 'Understand',
            knowledge_level: knowledgeLevel,
            time_budget: TIME_BUDGET_TO_API[timeBudget] || 'Focused',
            goal: GOAL_TO_API[endGoal] || 'Learn',
            output_format: FORMAT_TO_API[outputFormat] || 'Structured',
        };

        // Reset all state for a fresh analysis
        setAnalyzing(true);
        setAnalyzeError('');
        setSearchFocused(false);
        setPendingResult(null);
        setTransitionDone(false);
        setShowTransition(true);

        try {
            console.log('[Dashboard] Sending to API:', apiPayload);
            console.log('[Dashboard] Agent Keywords:', keywords);

            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API error: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Dashboard] API Response received');

            // Store result — the useEffect will navigate once transition is also done
            setPendingResult(result);
        } catch (err) {
            console.error('[Dashboard] API call failed:', err);
            setAnalyzeError(
                err.message ||
                'Failed to connect to the analysis backend. Make sure the server is running on port 8000.'
            );
            // On error, kill the transition immediately
            setShowTransition(false);
            setPendingResult(null);
            setTransitionDone(false);
        } finally {
            setAnalyzing(false);
        }
    };

    // === ROUTING ===

    if (showDashboard2 && analysisResult) {
        return (
            <Dashboard2
                analysisResult={analysisResult}
                userProfile={currentProfile}
                onBack={() => {
                    setShowDashboard2(false);
                    setAnalysisResult(null);
                }}
            />
        );
    }

    if (showResearchPage) {
        return <MyResearchPage onBack={() => setShowResearchPage(false)} />;
    }

    const userInitials = user.name
        ? user.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : user.email[0].toUpperCase();

    return (
        <>
            <TransitionAnimation
                active={showTransition}
                onComplete={handleTransitionComplete}
                minDuration={2500}
            />
            <div className="dashboard">
                <div className="bg-animation">
                    <div className="bg-grid" />
                    <div className="bg-gradient-top" />
                </div>

                <div className={`dim-overlay ${searchFocused ? 'active' : ''}`} />

                <header className="topbar">
                    <div className="topbar-left">
                        <div className="logo-icon">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            >
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="logo-text">Aurora.ai</span>
                    </div>
                    <div className="topbar-right">
                        <div style={{ position: 'relative' }} ref={userMenuRef}>
                            <button
                                className="user-avatar-btn"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                title={user.name || user.email}
                            >
                                {userInitials}
                            </button>
                            {showUserMenu && (
                                <div className="user-menu">
                                    <div className="user-menu-header">
                                        <div className="user-menu-avatar">{userInitials}</div>
                                        <div className="user-menu-info">
                                            <div className="user-menu-name">{user.name}</div>
                                            <div className="user-menu-email">{user.email}</div>
                                        </div>
                                    </div>
                                    <div className="user-menu-divider" />
                                    <button className="user-menu-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="8" r="4" />
                                            <path d="M4 21v-1a4 4 0 014-4h8a4 4 0 014 4v1" />
                                        </svg>
                                        Profile
                                    </button>
                                    <button className="user-menu-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="3" />
                                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                                        </svg>
                                        Settings
                                    </button>
                                    <div className="user-menu-divider" />
                                    <button className="user-menu-item danger" onClick={handleLogout}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                            <polyline points="16,17 21,12 16,7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div ref={overlayRef} className={`search-container ${searchFocused ? 'expanded' : ''}`}>
                    <div className="search-bar" onClick={() => setSearchFocused(true)}>
                        <span className="search-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            ref={searchRef}
                            type="text"
                            className="search-input"
                            placeholder='Enter Research Topic: "CRISPR gene editing applications"'
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !analyzing) handleAnalyze();
                            }}
                            disabled={analyzing}
                        />
                        {searchValue && !analyzing && (
                            <button
                                className="search-clear"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchValue('');
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className={`context-panel ${searchFocused ? 'focused' : ''}`}>
                        <h3 className="context-title">Set Your Context</h3>

                        <div className="persona-selector">
                            {PERSONAS.map((p) => {
                                const Icon = PERSONA_ICONS[p.icon];
                                return (
                                    <button
                                        key={p.id}
                                        className={`role-card ${persona === p.id ? 'active' : ''}`}
                                        onClick={() => {
                                            setPersona(p.id);
                                            setSearchFocused(true);
                                        }}
                                    >
                                        <Icon />
                                        <span className="role-name">{p.id}</span>
                                        <span className="role-label">{p.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <DiscreteDepthSlider value={depthValue} onChange={setDepthValue} />

                        {searchFocused && (
                            <div className="expanded-context">
                                <div className="context-section">
                                    <span className="section-label">Knowledge Level</span>
                                    <div className="chip-row">
                                        {KNOWLEDGE_LEVELS.map((level) => (
                                            <button
                                                key={level}
                                                className={`chip ${knowledgeLevel === level ? 'active' : ''}`}
                                                onClick={() => setKnowledgeLevel(level)}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="context-section">
                                    <span className="section-label">Time Budget</span>
                                    <div className="chip-row">
                                        {TIME_BUDGETS.map((tb) => (
                                            <button
                                                key={tb.id}
                                                className={`chip chip-wide ${timeBudget === tb.id ? 'active' : ''}`}
                                                onClick={() => setTimeBudget(tb.id)}
                                            >
                                                <span className="chip-main">{tb.label}</span>
                                                <span className="chip-sub">{tb.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="context-section">
                                    <span className="section-label">End Goal</span>
                                    <div className="chip-row">
                                        {END_GOALS.map((g) => (
                                            <button
                                                key={g.id}
                                                className={`chip ${endGoal === g.id ? 'active' : ''}`}
                                                onClick={() => setEndGoal(g.id)}
                                            >
                                                {g.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="context-section">
                                    <span className="section-label">Output Format</span>
                                    <div className="chip-row">
                                        {OUTPUT_FORMATS.map((f) => (
                                            <button
                                                key={f.id}
                                                className={`chip ${outputFormat === f.id ? 'active' : ''}`}
                                                onClick={() => setOutputFormat(f.id)}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <KeywordsDisplay keywords={generatedKeywords} />
                            </div>
                        )}

                        {!searchFocused && (
                            <div className="profile-preview">
                                <span className="preview-chip">{persona}</span>
                                <span className="preview-chip">{knowledgeLevel}</span>
                                <span className="preview-chip">{depthLabel}</span>
                                <span className="preview-chip">{END_GOALS.find((g) => g.id === endGoal)?.label}</span>
                                <span className="preview-chip">{OUTPUT_FORMATS.find((f) => f.id === outputFormat)?.label}</span>
                            </div>
                        )}

                        {analyzeError && (
                            <div className="form-error" style={{ margin: '12px 0' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {analyzeError}
                            </div>
                        )}

                        <button className="analyze-btn" onClick={handleAnalyze} disabled={analyzing || !searchValue.trim()}>
                            {analyzing ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                    <span className="spinner" />
                                    Analyzing — this may take a minute...
                                </span>
                            ) : (
                                'Analyze Topic & Synthesize'
                            )}
                        </button>
                    </div>
                </div>

                <div className={`cards-section ${searchFocused ? 'hidden' : ''}`}>
                    <div className="dash-card">
                        <div className="card-header">
                            <h3>Latest Papers Published</h3>
                            <button className="more-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="5" r="1.5" />
                                    <circle cx="12" cy="12" r="1.5" />
                                    <circle cx="12" cy="19" r="1.5" />
                                </svg>
                            </button>
                        </div>
                        <div className="papers-list">
                            {loadingPapers ? (
                                <div className="loading-placeholder">Loading papers...</div>
                            ) : (
                                papers.map((p, i) => (
                                    <a key={i} className="paper-item" href={p.url} target="_blank" rel="noopener noreferrer">
                                        <div className="paper-title">{p.title}</div>
                                        <div className="paper-meta">
                                            <span className={`paper-tag ${p.tag === 'Recent' ? 'trending' : ''}`}>{p.tag}</span>
                                            <span className="paper-time">{p.time}</span>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="dash-card dash-card-wide">
                        <div className="card-header">
                            <h3>Chat History</h3>
                        </div>
                        <div className="coming-soon-content">
                            <div className="coming-soon-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                                    <line x1="9" y1="9" x2="15" y2="9" opacity="0.4" />
                                    <line x1="9" y1="12" x2="13" y2="12" opacity="0.4" />
                                </svg>
                            </div>
                            <h4 className="coming-soon-title">Chat History</h4>
                            <p className="coming-soon-text">Will be available soon.</p>
                            <p className="coming-soon-subtext">
                                This feature is currently under development. You will be able to view and manage your full conversation
                                history here.
                            </p>
                        </div>
                    </div>

                    <div
                        className="dash-card dash-card-clickable"
                        onClick={() => {
                            window.history.pushState({ page: 'research' }, '', '#research');
                            setShowResearchPage(true);
                        }}
                    >
                        <div className="card-header">
                            <h3>Work With My Research Paper</h3>
                            <span className="card-arrow">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </span>
                        </div>
                        <div className="research-card-content">
                            <div className="research-card-icon">
                                <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="15" y="8" width="35" height="45" rx="3" />
                                    <path d="M22 20H42M22 27H42M22 34H35" strokeLinecap="round" />
                                    <circle cx="55" cy="55" r="18" strokeWidth="2" />
                                    <path d="M55 45V55L62 59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div className="research-card-features">
                                <p className="research-card-desc">Upload your own paper and let AI help you:</p>
                                <ul className="research-card-list">
                                    <li>Generate summaries & abstracts</li>
                                    <li>Visualize concept relationships</li>
                                    <li>Critical analysis & gap detection</li>
                                    <li>Map citation networks</li>
                                    <li>Generate discussion questions</li>
                                </ul>
                            </div>
                        </div>
                        <div className="research-card-cta">
                            <span>Upload & Analyze Paper</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}