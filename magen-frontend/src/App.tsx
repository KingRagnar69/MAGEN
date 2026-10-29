
import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8080";

type InstanceSummary = {
    id: number;
    name: string;
    createdAt: string;
    characterCount: number;
    panelCount: number;
};

type Character = {
    id: number;
    name: string;
    description: string;
    negativePrompt: string;
    image: string;
    createdAt: string | null;
};

type MangaPanel = {
    id: number;
    prompt: string;
    characters: string[];
    image: string;
    createdAt: string;
};

type MangaInstance = {
    id: number;
    name: string;
    createdAt: string;
    characters: Character[];
    panels: MangaPanel[];
};

type GeneratedImage = {
    image: string;
    imagePath: string;
};

type Page = "dashboard" | "instance" | "characters" | "manga";

const DEFAULT_NEGATIVE_PROMPT =
    "blurry, low quality, bad anatomy, extra fingers, deformed hands, duplicate characters";

async function api<T>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    const text = await response.text();

    if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`);
    }

    if (!text.trim()) {
        return undefined as T;
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        return text as T;
    }
}

function imageSource(image: string): string {
    if (!image) return "";

    return image.startsWith("data:image/") ||
    image.startsWith("blob:") ||
    image.startsWith("http://") ||
    image.startsWith("https://")
        ? image
        : `${API_BASE}${image.startsWith("/") ? "" : "/"}${image}`;
}

function formatDate(date: string | null | undefined): string {
    if (!date) return "Recently created";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
}

function App() {
    const [instances, setInstances] = useState<InstanceSummary[]>([]);
    const [activeInstance, setActiveInstance] =
        useState<MangaInstance | null>(null);
    const [page, setPage] = useState<Page>("dashboard");

    const [instanceName, setInstanceName] = useState("");
    const [characterName, setCharacterName] = useState("");
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] =
        useState(DEFAULT_NEGATIVE_PROMPT);

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [generatedCharacter, setGeneratedCharacter] =
        useState<GeneratedImage | null>(null);

    const [scenePrompt, setScenePrompt] = useState("");
    const [selectedCharacterIds, setSelectedCharacterIds] =
        useState<number[]>([]);
    const [generatedPanel, setGeneratedPanel] =
        useState<GeneratedImage | null>(null);
    const [panelLoading, setPanelLoading] = useState(false);
    const [panelMessage, setPanelMessage] = useState("");

    useEffect(() => {
        void loadInstances();
    }, []);

    async function loadInstances() {
        try {
            const data = await api<InstanceSummary[]>("/api/instances");
            setInstances(data);
        } catch (error) {
            setMessage(errorMessage(error));
        }
    }

    async function refreshActiveInstance(instanceId: number) {
        const data = await api<MangaInstance>(
            `/api/instances/${instanceId}`
        );

        setActiveInstance(data);
        await loadInstances();
    }

    async function createInstance() {
        const name = instanceName.trim();

        if (!name) {
            setMessage("Enter a name for your manga project.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const instance = await api<InstanceSummary>(
                "/api/instances",
                {
                    method: "POST",
                    body: JSON.stringify({ name }),
                }
            );

            setInstanceName("");
            await loadInstances();
            await openInstance(instance.id);
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    async function openInstance(instanceId: number) {
        try {
            const instance = await api<MangaInstance>(
                `/api/instances/${instanceId}`
            );

            setActiveInstance(instance);
            setPage("instance");
            setMessage("");
            setPanelMessage("");
            setSelectedCharacterIds([]);
        } catch (error) {
            setMessage(errorMessage(error));
        }
    }

    function goToDashboard() {
        setPage("dashboard");
        setActiveInstance(null);
        setMessage("");
        setPanelMessage("");
        void loadInstances();
    }

    async function generateCharacter() {
        if (!activeInstance) {
            setMessage("Create or open a project first.");
            return;
        }

        if (!characterName.trim() || !prompt.trim()) {
            setMessage("Enter a character name and positive prompt.");
            return;
        }

        setLoading(true);
        setMessage("Generating your character through ComfyUI...");
        setGeneratedCharacter(null);

        try {
            const generated = await api<GeneratedImage>(
                "/api/ai/characters",
                {
                    method: "POST",
                    body: JSON.stringify({
                        name: characterName.trim(),
                        description: prompt.trim(),
                        negativePrompt: negativePrompt.trim(),
                    }),
                }
            );

            setGeneratedCharacter(generated);
            setMessage(
                "Character generated successfully. Review the preview before saving."
            );
        } catch (error) {
            setMessage(errorMessage(error));
            console.error("Character generation failed:", error);
        } finally {
            setLoading(false);
        }
    }

    async function saveCharacter() {
        if (!activeInstance || !generatedCharacter) {
            setMessage("Generate a character before saving it.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            await api<Character>("/api/ai/characters/save", {
                method: "POST",
                body: JSON.stringify({
                    instanceId: activeInstance.id,
                    name: characterName.trim(),
                    description: prompt.trim(),
                    negativePrompt: negativePrompt.trim(),
                    imagePath: generatedCharacter.imagePath,
                }),
            });

            await refreshActiveInstance(activeInstance.id);

            setMessage(`Character "${characterName.trim()}" saved.`);
            setGeneratedCharacter(null);
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    function toggleCharacterSelection(characterId: number) {
        setSelectedCharacterIds((previous) =>
            previous.includes(characterId)
                ? previous.filter((id) => id !== characterId)
                : [...previous, characterId]
        );
    }

    async function generateMangaPanel() {
        if (!activeInstance) {
            setPanelMessage("Open a project first.");
            return;
        }

        if (activeInstance.characters.length === 0) {
            setPanelMessage("Save a character before generating a panel.");
            return;
        }

        if (selectedCharacterIds.length === 0) {
            setPanelMessage("Select at least one saved character.");
            return;
        }

        if (!scenePrompt.trim()) {
            setPanelMessage("Enter a scene description.");
            return;
        }

        setPanelLoading(true);
        setPanelMessage("Generating your manga panel...");
        setGeneratedPanel(null);

        try {
            const generated = await api<GeneratedImage>(
                "/api/ai/manga",
                {
                    method: "POST",
                    body: JSON.stringify({
                        instanceId: activeInstance.id,
                        prompt: scenePrompt.trim(),
                        characterIds: selectedCharacterIds,
                    }),
                }
            );

            setGeneratedPanel(generated);
            setPanelMessage(
                "Panel generated. Review the result before saving."
            );
        } catch (error) {
            setPanelMessage(errorMessage(error));
            console.error("Manga generation failed:", error);
        } finally {
            setPanelLoading(false);
        }
    }

    async function saveMangaPanel() {
        if (!activeInstance || !generatedPanel) {
            setPanelMessage("Generate a manga panel first.");
            return;
        }

        setPanelLoading(true);
        setPanelMessage("");

        try {
            await api<MangaPanel>("/api/ai/manga/save", {
                method: "POST",
                body: JSON.stringify({
                    instanceId: activeInstance.id,
                    prompt: scenePrompt.trim(),
                    imagePath: generatedPanel.imagePath,
                    characterIds: selectedCharacterIds,
                }),
            });

            await refreshActiveInstance(activeInstance.id);
            setGeneratedPanel(null);
            setPanelMessage("Manga panel saved successfully.");
        } catch (error) {
            setPanelMessage(errorMessage(error));
        } finally {
            setPanelLoading(false);
        }
    }

    function resetCharacterForm() {
        setCharacterName("");
        setPrompt("");
        setNegativePrompt(DEFAULT_NEGATIVE_PROMPT);
        setGeneratedCharacter(null);
        setMessage("");
    }

    function navigateTo(nextPage: Page) {
        setPage(nextPage);
        setMessage("");
        setPanelMessage("");
    }

    const totalCharacters = instances.reduce(
        (total, instance) => total + instance.characterCount,
        0
    );

    const totalPanels = instances.reduce(
        (total, instance) => total + instance.panelCount,
        0
    );

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <button
                    className="brand"
                    onClick={goToDashboard}
                    aria-label="Go to MAGEN dashboard"
                >
                    <span className="brand-mark">M</span>
                    <span className="brand-copy">
                        <strong>MAGEN</strong>
                        <small>CREATIVE STUDIO</small>
                    </span>
                </button>

                <div className="sidebar-label">WORKSPACE</div>

                <nav className="sidebar-nav" aria-label="Main navigation">
                    <button
                        className={`sidebar-link ${
                            page === "dashboard" ? "active" : ""
                        }`}
                        onClick={goToDashboard}
                    >
                        <span className="nav-icon">⌂</span>
                        <span>Dashboard</span>
                    </button>

                    <button
                        className={`sidebar-link ${
                            page === "instance" ? "active" : ""
                        }`}
                        onClick={() =>
                            activeInstance
                                ? navigateTo("instance")
                                : setMessage("Open a project first.")
                        }
                    >
                        <span className="nav-icon">▦</span>
                        <span>Project overview</span>
                    </button>

                    <button
                        className={`sidebar-link ${
                            page === "characters" ? "active" : ""
                        }`}
                        onClick={() =>
                            activeInstance
                                ? navigateTo("characters")
                                : setMessage("Open a project first.")
                        }
                    >
                        <span className="nav-icon">♙</span>
                        <span>Characters</span>
                    </button>

                    <button
                        className={`sidebar-link ${
                            page === "manga" ? "active" : ""
                        }`}
                        onClick={() =>
                            activeInstance
                                ? navigateTo("manga")
                                : setMessage("Open a project first.")
                        }
                    >
                        <span className="nav-icon">▤</span>
                        <span>Manga panels</span>
                    </button>
                </nav>

                <div className="sidebar-divider" />

                <div className="sidebar-label">YOUR PROJECTS</div>

                <div className="sidebar-projects">
                    {instances.length === 0 ? (
                        <p className="sidebar-empty">No projects yet</p>
                    ) : (
                        instances.slice(0, 5).map((instance) => (
                            <button
                                className={`project-shortcut ${
                                    activeInstance?.id === instance.id
                                        ? "selected"
                                        : ""
                                }`}
                                key={instance.id}
                                onClick={() =>
                                    void openInstance(instance.id)
                                }
                            >
                                <span className="project-dot" />
                                <span className="project-shortcut-name">
                                    {instance.name}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                <div className="sidebar-spacer" />

                <div className="sidebar-footer">
                    <div className="footer-orbit">✳</div>
                    <div>
                        <strong>Made for storytellers</strong>
                        <p>Bring your manga to life.</p>
                    </div>
                </div>

                <div className="version-label">MAGEN · DEVELOPMENT BUILD</div>
            </aside>

            <div className="main-column">
                <header className="topbar">
                    <div className="breadcrumb">
                        <span>Studio</span>
                        <span className="breadcrumb-divider">/</span>
                        <strong>
                            {page === "dashboard"
                                ? "Dashboard"
                                : activeInstance?.name ?? "Workspace"}
                        </strong>
                    </div>

                    <div className="topbar-right">
                        <span className="system-status">
                            <span className="status-dot" />
                            Local AI workspace
                        </span>

                        <div className="avatar">M</div>
                    </div>
                </header>

                <main className="workspace">
                    {message && (
                        <div
                            className="notice"
                            role="status"
                            aria-live="polite"
                        >
                            <span className="notice-mark">i</span>
                            <span>{message}</span>
                            <button
                                className="notice-close"
                                onClick={() => setMessage("")}
                                aria-label="Dismiss message"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {page === "dashboard" && (
                        <>
                            <section className="welcome-section">
                                <div className="eyebrow">
                                    <span className="eyebrow-line" />
                                    YOUR CREATIVE UNIVERSE
                                </div>

                                <h1>
                                    Every great story
                                    <br />
                                    starts with <span>one frame.</span>
                                </h1>

                                <p className="welcome-description">
                                    Build memorable characters, create
                                    cinematic manga panels, and bring your
                                    imagination to life with AI.
                                </p>

                                <button
                                    className="button button-primary hero-button"
                                    onClick={() => {
                                        document
                                            .getElementById("create-project")
                                            ?.scrollIntoView({
                                                behavior: "smooth",
                                                block: "center",
                                            });
                                    }}
                                >
                                    <span>＋</span> Create a project
                                </button>

                                <div
                                    className="hero-decoration"
                                    aria-hidden="true"
                                >
                                    <div className="hero-frame frame-back">
                                        <div className="frame-art art-back">
                                            <span>夢</span>
                                        </div>
                                    </div>
                                    <div className="hero-frame frame-front">
                                        <div className="frame-art art-front">
                                            <span className="art-spark">✦</span>
                                            <span className="art-kanji">漫</span>
                                            <span className="art-caption">
                                                YOUR STORY
                                            </span>
                                        </div>
                                    </div>
                                    <div className="decoration-orbit orbit-one" />
                                    <div className="decoration-orbit orbit-two" />
                                    <span className="decoration-star star-one">✳</span>
                                    <span className="decoration-star star-two">✦</span>
                                </div>
                            </section>

                            <section className="stats-grid">
                                <article className="stat-card">
                                    <div className="stat-top">
                                        <span className="stat-icon violet">
                                            ▦
                                        </span>
                                        <span className="stat-caption">
                                            TOTAL WORKSPACES
                                        </span>
                                    </div>
                                    <div className="stat-value">
                                        {instances.length}
                                    </div>
                                    <p>Creative projects</p>
                                </article>

                                <article className="stat-card">
                                    <div className="stat-top">
                                        <span className="stat-icon pink">
                                            ♙
                                        </span>
                                        <span className="stat-caption">
                                            CHARACTER LIBRARY
                                        </span>
                                    </div>
                                    <div className="stat-value">
                                        {totalCharacters}
                                    </div>
                                    <p>Saved character references</p>
                                </article>

                                <article className="stat-card">
                                    <div className="stat-top">
                                        <span className="stat-icon blue">
                                            ▤
                                        </span>
                                        <span className="stat-caption">
                                            MANGA COLLECTION
                                        </span>
                                    </div>
                                    <div className="stat-value">
                                        {totalPanels}
                                    </div>
                                    <p>Saved manga panels</p>
                                </article>
                            </section>

                            <section
                                className="create-section"
                                id="create-project"
                            >
                                <div className="section-heading">
                                    <div>
                                        <div className="eyebrow">
                                            LET'S GET STARTED
                                        </div>
                                        <h2>Create your next universe</h2>
                                        <p>
                                            Give your story a name. Everything
                                            you create will live inside its own
                                            project.
                                        </p>
                                    </div>
                                </div>

                                <form
                                    className="create-project-form"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void createInstance();
                                    }}
                                >
                                    <div className="field field-grow">
                                        <label htmlFor="instanceName">
                                            PROJECT NAME
                                        </label>
                                        <input
                                            id="instanceName"
                                            value={instanceName}
                                            onChange={(event) =>
                                                setInstanceName(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="e.g. The Last Shinobi"
                                            maxLength={120}
                                        />
                                    </div>

                                    <button
                                        className="button button-primary create-button"
                                        type="submit"
                                        disabled={loading}
                                    >
                                        {loading
                                            ? "Creating..."
                                            : "Create project"}
                                        <span>↗</span>
                                    </button>
                                </form>
                            </section>

                            <section className="projects-section">
                                <div className="section-heading section-heading-row">
                                    <div>
                                        <div className="eyebrow">
                                            YOUR WORK IN PROGRESS
                                        </div>
                                        <h2>Your projects</h2>
                                    </div>
                                    <span className="count-pill">
                                        {instances.length}{" "}
                                        {instances.length === 1
                                            ? "project"
                                            : "projects"}
                                    </span>
                                </div>

                                {instances.length === 0 ? (
                                    <div className="empty-projects">
                                        <div className="empty-illustration">
                                            <span>✧</span>
                                        </div>
                                        <h3>Your story begins here</h3>
                                        <p>
                                            Create your first project to start
                                            building characters and generating
                                            manga panels.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="project-grid">
                                        {instances.map((instance, index) => (
                                            <button
                                                className="project-card"
                                                key={instance.id}
                                                onClick={() =>
                                                    void openInstance(
                                                        instance.id
                                                    )
                                                }
                                            >
                                                <div
                                                    className={`project-cover cover-${index % 4}`}
                                                >
                                                    <span className="cover-index">
                                                        {String(index + 1).padStart(
                                                            2,
                                                            "0"
                                                        )}
                                                    </span>
                                                    <span className="cover-symbol">
                                                        {["漫", "夢", "影", "月"][
                                                        index % 4
                                                            ]}
                                                    </span>
                                                    <span className="cover-label">
                                                        MAGEN ORIGINAL
                                                    </span>
                                                </div>

                                                <div className="project-card-body">
                                                    <div className="project-card-title">
                                                        <h3>{instance.name}</h3>
                                                        <span className="card-arrow">
                                                            ↗
                                                        </span>
                                                    </div>
                                                    <p>
                                                        {instance.characterCount}{" "}
                                                        {instance.characterCount ===
                                                        1
                                                            ? "character"
                                                            : "characters"}
                                                        <span>·</span>
                                                        {instance.panelCount}{" "}
                                                        {instance.panelCount ===
                                                        1
                                                            ? "panel"
                                                            : "panels"}
                                                    </p>
                                                    <div className="project-card-bottom">
                                                        <span>
                                                            <span className="mini-dot" />
                                                            Project workspace
                                                        </span>
                                                        <span>
                                                            {formatDate(
                                                                instance.createdAt
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {page !== "dashboard" && activeInstance && (
                        <>
                            <section className="workspace-heading">
                                <button
                                    className="back-link"
                                    onClick={goToDashboard}
                                >
                                    <span>←</span> All projects
                                </button>

                                <div className="workspace-title-row">
                                    <div>
                                        <div className="eyebrow">
                                            PROJECT WORKSPACE
                                        </div>
                                        <h1>{activeInstance.name}</h1>
                                        <p>
                                            Your characters, scenes, and manga
                                            collection in one place.
                                        </p>
                                    </div>

                                    <div className="workspace-badges">
                                        <span className="workspace-badge">
                                            <span className="status-dot" />
                                            Active project
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <nav
                                className="workspace-tabs"
                                aria-label="Project sections"
                            >
                                {(
                                    [
                                        ["instance", "Overview", "▦"],
                                        ["characters", "Characters", "♙"],
                                        ["manga", "Manga panels", "▤"],
                                    ] as const
                                ).map(([value, label, icon]) => (
                                    <button
                                        key={value}
                                        className={`workspace-tab ${
                                            page === value ? "active" : ""
                                        }`}
                                        onClick={() =>
                                            navigateTo(value)
                                        }
                                    >
                                        <span>{icon}</span>
                                        {label}
                                    </button>
                                ))}
                            </nav>

                            {page === "instance" && (
                                <section className="overview-section">
                                    <div className="overview-banner">
                                        <div>
                                            <div className="eyebrow">
                                                YOUR STORY, YOUR WORLD
                                            </div>
                                            <h2>
                                                Where will your imagination
                                                take you?
                                            </h2>
                                            <p>
                                                Start with a character, then
                                                turn your ideas into manga
                                                scenes.
                                            </p>
                                        </div>
                                        <div
                                            className="banner-symbol"
                                            aria-hidden="true"
                                        >
                                            <span>創</span>
                                        </div>
                                    </div>

                                    <div className="overview-action-grid">
                                        <article className="action-card">
                                            <div className="action-card-top">
                                                <span className="stat-icon pink">
                                                    ♙
                                                </span>
                                                <span className="action-number">
                                                    01 / CHARACTER
                                                </span>
                                            </div>
                                            <h3>Build your cast</h3>
                                            <p>
                                                Design characters and save
                                                their references for reuse in
                                                future scenes.
                                            </p>
                                            <div className="action-card-bottom">
                                                <span className="action-count">
                                                    {activeInstance.characters.length}{" "}
                                                    saved
                                                </span>
                                                <button
                                                    className="button button-secondary"
                                                    onClick={() =>
                                                        navigateTo(
                                                            "characters"
                                                        )
                                                    }
                                                >
                                                    Create character <span>→</span>
                                                </button>
                                            </div>
                                        </article>

                                        <article className="action-card">
                                            <div className="action-card-top">
                                                <span className="stat-icon blue">
                                                    ▤
                                                </span>
                                                <span className="action-number">
                                                    02 / STORYBOARD
                                                </span>
                                            </div>
                                            <h3>Frame your story</h3>
                                            <p>
                                                Select your saved characters
                                                and describe the scene you want
                                                to bring to life.
                                            </p>
                                            <div className="action-card-bottom">
                                                <span className="action-count">
                                                    {activeInstance.panels.length}{" "}
                                                    saved
                                                </span>
                                                <button
                                                    className="button button-secondary"
                                                    onClick={() =>
                                                        navigateTo("manga")
                                                    }
                                                >
                                                    Create panel <span>→</span>
                                                </button>
                                            </div>
                                        </article>
                                    </div>

                                    <section className="collection-section">
                                        <div className="section-heading section-heading-row">
                                            <div>
                                                <div className="eyebrow">
                                                    YOUR CAST
                                                </div>
                                                <h2>Character library</h2>
                                            </div>
                                            {activeInstance.characters.length >
                                                0 && (
                                                    <button
                                                        className="text-action"
                                                        onClick={() =>
                                                            navigateTo(
                                                                "characters"
                                                            )
                                                        }
                                                    >
                                                        Create another <span>→</span>
                                                    </button>
                                                )}
                                        </div>

                                        {activeInstance.characters.length ===
                                        0 ? (
                                            <div className="empty-collection">
                                                <span className="empty-icon">
                                                    ♙
                                                </span>
                                                <div>
                                                    <h3>No characters yet</h3>
                                                    <p>
                                                        Create your first
                                                        character to begin
                                                        building your cast.
                                                    </p>
                                                </div>
                                                <button
                                                    className="button button-primary"
                                                    onClick={() =>
                                                        navigateTo(
                                                            "characters"
                                                        )
                                                    }
                                                >
                                                    Create character
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="character-grid">
                                                {activeInstance.characters.map(
                                                    (character) => (
                                                        <article
                                                            className="character-card"
                                                            key={character.id}
                                                        >
                                                            <div className="gallery-image">
                                                                <img
                                                                    src={imageSource(
                                                                        character.image
                                                                    )}
                                                                    alt={
                                                                        character.name
                                                                    }
                                                                    loading="lazy"
                                                                />
                                                                <span className="image-badge">
                                                                    CHARACTER
                                                                </span>
                                                            </div>
                                                            <div className="gallery-card-body">
                                                                <h3>
                                                                    {character.name}
                                                                </h3>
                                                                <p>
                                                                    {character.description}
                                                                </p>
                                                            </div>
                                                        </article>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </section>

                                    <section className="collection-section">
                                        <div className="section-heading section-heading-row">
                                            <div>
                                                <div className="eyebrow">
                                                    YOUR STORYBOARD
                                                </div>
                                                <h2>Manga collection</h2>
                                            </div>
                                            {activeInstance.panels.length >
                                                0 && (
                                                    <button
                                                        className="text-action"
                                                        onClick={() =>
                                                            navigateTo("manga")
                                                        }
                                                    >
                                                        Create another <span>→</span>
                                                    </button>
                                                )}
                                        </div>

                                        {activeInstance.panels.length === 0 ? (
                                            <div className="empty-collection">
                                                <span className="empty-icon">
                                                    ▤
                                                </span>
                                                <div>
                                                    <h3>No panels yet</h3>
                                                    <p>
                                                        Generate a scene using
                                                        your saved character
                                                        references.
                                                    </p>
                                                </div>
                                                <button
                                                    className="button button-primary"
                                                    onClick={() =>
                                                        navigateTo("manga")
                                                    }
                                                >
                                                    Generate panel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="panel-grid">
                                                {activeInstance.panels.map(
                                                    (panel) => (
                                                        <article
                                                            className="panel-card"
                                                            key={panel.id}
                                                        >
                                                            <div className="gallery-image panel-image">
                                                                <img
                                                                    src={imageSource(
                                                                        panel.image
                                                                    )}
                                                                    alt={
                                                                        panel.prompt
                                                                    }
                                                                    loading="lazy"
                                                                />
                                                                <span className="image-badge">
                                                                    MANGA PANEL
                                                                </span>
                                                            </div>
                                                            <div className="gallery-card-body">
                                                                <h3>
                                                                    {panel.prompt}
                                                                </h3>
                                                                <p>
                                                                    Characters:{" "}
                                                                    {panel.characters.join(
                                                                        ", "
                                                                    ) || "None listed"}
                                                                </p>
                                                            </div>
                                                        </article>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </section>
                                </section>
                            )}

                            {page === "characters" && (
                                <section className="creation-layout">
                                    <div className="creation-intro">
                                        <div className="eyebrow">
                                            CHARACTER DESIGN STUDIO
                                        </div>
                                        <h2>
                                            Meet the heroes of your story.
                                        </h2>
                                        <p>
                                            Define their appearance, generate
                                            a reference image, and save the
                                            result to your project's character
                                            library.
                                        </p>

                                        <div className="process-steps">
                                            <div className="process-step current">
                                                <span>01</span>
                                                <div>
                                                    <strong>Describe</strong>
                                                    <small>
                                                        Define your character
                                                    </small>
                                                </div>
                                            </div>
                                            <div className="process-connector" />
                                            <div className="process-step">
                                                <span>02</span>
                                                <div>
                                                    <strong>Generate</strong>
                                                    <small>
                                                        Create the reference
                                                    </small>
                                                </div>
                                            </div>
                                            <div className="process-connector" />
                                            <div className="process-step">
                                                <span>03</span>
                                                <div>
                                                    <strong>Save</strong>
                                                    <small>
                                                        Add to your library
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="editor-card">
                                        <div className="editor-card-heading">
                                            <div>
                                                <span className="editor-step">
                                                    STEP 01
                                                </span>
                                                <h3>Character details</h3>
                                            </div>
                                            <span className="editor-heading-icon">
                                                ✳
                                            </span>
                                        </div>

                                        <div className="field">
                                            <label htmlFor="characterName">
                                                CHARACTER NAME
                                            </label>
                                            <input
                                                id="characterName"
                                                value={characterName}
                                                onChange={(event) =>
                                                    setCharacterName(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="e.g. Akira Moonshadow"
                                                maxLength={120}
                                            />
                                        </div>

                                        <div className="field">
                                            <div className="label-row">
                                                <label htmlFor="prompt">
                                                    CHARACTER DESCRIPTION
                                                </label>
                                                <span className="field-hint">
                                                    Required
                                                </span>
                                            </div>
                                            <textarea
                                                id="prompt"
                                                value={prompt}
                                                onChange={(event) =>
                                                    setPrompt(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Silver hair, sharp violet eyes, black samurai armor, detailed manga illustration, full-body character reference, dramatic lighting..."
                                                rows={6}
                                            />
                                            <p className="field-help">
                                                Describe the face, hair,
                                                clothing, anatomy, pose, and
                                                art style.
                                            </p>
                                        </div>

                                        <div className="field">
                                            <label htmlFor="negativePrompt">
                                                NEGATIVE PROMPT
                                            </label>
                                            <textarea
                                                id="negativePrompt"
                                                value={negativePrompt}
                                                onChange={(event) =>
                                                    setNegativePrompt(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Elements you want the model to avoid..."
                                                rows={3}
                                            />
                                        </div>

                                        <div className="editor-actions">
                                            <button
                                                className="button button-primary button-wide"
                                                onClick={() =>
                                                    void generateCharacter()
                                                }
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="spinner" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>✦</span>
                                                        Generate character
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                className="button button-ghost"
                                                onClick={resetCharacterForm}
                                                disabled={loading}
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <p className="editor-footnote">
                                            <span>✧</span> Generated images
                                            will be reviewed before being saved
                                            to your project.
                                        </p>

                                        {generatedCharacter && (
                                            <div className="generated-result">
                                                <div className="result-heading">
                                                    <div>
                                                        <span className="editor-step">
                                                            GENERATION RESULT
                                                        </span>
                                                        <h3>
                                                            {characterName}
                                                        </h3>
                                                    </div>
                                                    <span className="result-status">
                                                        Ready to save
                                                    </span>
                                                </div>

                                                <img
                                                    className="generated-image"
                                                    src={generatedCharacter.image}
                                                    alt={`Generated character: ${characterName}`}
                                                />

                                                <button
                                                    className="button button-primary button-wide"
                                                    onClick={() =>
                                                        void saveCharacter()
                                                    }
                                                    disabled={loading}
                                                >
                                                    {loading
                                                        ? "Saving..."
                                                        : "Save to character library"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {page === "manga" && (
                                <section className="creation-layout">
                                    <div className="creation-intro">
                                        <div className="eyebrow">
                                            MANGA PANEL WORKSHOP
                                        </div>
                                        <h2>
                                            Turn a moment into a manga panel.
                                        </h2>
                                        <p>
                                            Choose the characters in your
                                            scene, describe the action, and
                                            generate a new frame for your
                                            story.
                                        </p>

                                        <div className="process-steps">
                                            <div className="process-step current">
                                                <span>01</span>
                                                <div>
                                                    <strong>Select</strong>
                                                    <small>
                                                        Choose your cast
                                                    </small>
                                                </div>
                                            </div>
                                            <div className="process-connector" />
                                            <div className="process-step">
                                                <span>02</span>
                                                <div>
                                                    <strong>Describe</strong>
                                                    <small>
                                                        Set up the scene
                                                    </small>
                                                </div>
                                            </div>
                                            <div className="process-connector" />
                                            <div className="process-step">
                                                <span>03</span>
                                                <div>
                                                    <strong>Generate</strong>
                                                    <small>
                                                        Create the panel
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="editor-card">
                                        <div className="editor-card-heading">
                                            <div>
                                                <span className="editor-step">
                                                    STEP 01
                                                </span>
                                                <h3>Scene composition</h3>
                                            </div>
                                            <span className="editor-heading-icon">
                                                ▤
                                            </span>
                                        </div>

                                        <div className="field">
                                            <div className="label-row">
                                                <label>
                                                    SELECT CHARACTERS
                                                </label>
                                                <span className="field-hint">
                                                    {selectedCharacterIds.length}{" "}
                                                    selected
                                                </span>
                                            </div>

                                            {activeInstance.characters.length ===
                                            0 ? (
                                                <div className="inline-empty">
                                                    <span>♙</span>
                                                    <div>
                                                        <strong>
                                                            Your cast is waiting
                                                        </strong>
                                                        <p>
                                                            Save a character
                                                            before generating a
                                                            panel.
                                                        </p>
                                                    </div>
                                                    <button
                                                        className="button button-secondary"
                                                        onClick={() =>
                                                            navigateTo(
                                                                "characters"
                                                            )
                                                        }
                                                    >
                                                        Create character
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="select-character-grid">
                                                    {activeInstance.characters.map(
                                                        (character) => {
                                                            const selected =
                                                                selectedCharacterIds.includes(
                                                                    character.id
                                                                );

                                                            return (
                                                                <label
                                                                    className={`select-character ${
                                                                        selected
                                                                            ? "selected"
                                                                            : ""
                                                                    }`}
                                                                    key={
                                                                        character.id
                                                                    }
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            selected
                                                                        }
                                                                        onChange={() =>
                                                                            toggleCharacterSelection(
                                                                                character.id
                                                                            )
                                                                        }
                                                                    />
                                                                    <img
                                                                        src={imageSource(
                                                                            character.image
                                                                        )}
                                                                        alt=""
                                                                        loading="lazy"
                                                                    />
                                                                    <span className="select-character-name">
                                                                        {
                                                                            character.name
                                                                        }
                                                                    </span>
                                                                    <span className="selection-check">
                                                                        ✓
                                                                    </span>
                                                                </label>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="field">
                                            <label htmlFor="scenePrompt">
                                                SCENE DESCRIPTION
                                            </label>
                                            <textarea
                                                id="scenePrompt"
                                                value={scenePrompt}
                                                onChange={(event) =>
                                                    setScenePrompt(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="A dramatic nighttime rooftop battle, rain pouring over the city, the hero dodges a glowing sword strike, dynamic low camera angle, black-and-white manga ink, speed lines..."
                                                rows={6}
                                            />
                                            <p className="field-help">
                                                Describe the action, setting,
                                                emotions, camera angle, and
                                                visual composition.
                                            </p>
                                        </div>

                                        <button
                                            className="button button-primary button-wide"
                                            onClick={() =>
                                                void generateMangaPanel()
                                            }
                                            disabled={
                                                panelLoading ||
                                                activeInstance.characters
                                                    .length === 0
                                            }
                                        >
                                            {panelLoading ? (
                                                <>
                                                    <span className="spinner" />
                                                    Generating panel...
                                                </>
                                            ) : (
                                                <>
                                                    <span>✦</span>
                                                    Generate manga panel
                                                </>
                                            )}
                                        </button>

                                        <p className="editor-footnote">
                                            <span>✧</span> Generated panels
                                            can be reviewed before saving.
                                        </p>

                                        {panelMessage && (
                                            <div
                                                className="notice panel-notice"
                                                role="status"
                                                aria-live="polite"
                                            >
                                                <span className="notice-mark">
                                                    i
                                                </span>
                                                <span>{panelMessage}</span>
                                            </div>
                                        )}

                                        {generatedPanel && (
                                            <div className="generated-result">
                                                <div className="result-heading">
                                                    <div>
                                                        <span className="editor-step">
                                                            GENERATION RESULT
                                                        </span>
                                                        <h3>
                                                            Your manga panel
                                                        </h3>
                                                    </div>
                                                    <span className="result-status">
                                                        Ready to save
                                                    </span>
                                                </div>

                                                <img
                                                    className="generated-image"
                                                    src={generatedPanel.image}
                                                    alt="Generated manga panel"
                                                />

                                                <button
                                                    className="button button-primary button-wide"
                                                    onClick={() =>
                                                        void saveMangaPanel()
                                                    }
                                                    disabled={panelLoading}
                                                >
                                                    {panelLoading
                                                        ? "Saving..."
                                                        : "Save to manga collection"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    {page !== "dashboard" && !activeInstance && (
                        <div className="empty-projects">
                            <div className="empty-illustration">
                                <span>✧</span>
                            </div>
                            <h3>No project selected</h3>
                            <p>
                                Open a project from your dashboard to continue.
                            </p>
                            <button
                                className="button button-primary"
                                onClick={goToDashboard}
                            >
                                Back to dashboard
                            </button>
                        </div>
                    )}

                    <footer className="workspace-footer">
                        <span>
                            <span className="footer-dot" />
                            MAGEN CREATIVE STUDIO
                        </span>
                        <span>Every frame tells a story.</span>
                    </footer>
                </main>
            </div>
        </div>
    );
}

export default App;
