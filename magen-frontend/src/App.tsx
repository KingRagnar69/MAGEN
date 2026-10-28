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

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
}

function imageSource(image: string): string {
    return image.startsWith("data:image/")
        ? image
        : `${API_BASE}${image}`;
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

    function errorMessage(error: unknown): string {
        return error instanceof Error
            ? error.message
            : "An unexpected error occurred.";
    }

    async function createInstance() {
        const name = instanceName.trim();

        if (!name) {
            setMessage("Enter a name for your manga instance.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const instance = await api<InstanceSummary>("/api/instances", {
                method: "POST",
                body: JSON.stringify({ name }),
            });

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
            setMessage("Create or open an instance first.");
            return;
        }

        if (!characterName.trim() || !prompt.trim()) {
            setMessage("Enter a character name and positive prompt.");
            return;
        }

        setLoading(true);
        setMessage("Sending character generation request to ComfyUI...");
        setGeneratedCharacter(null);

        try {
            const generated = await api<GeneratedImage>("/api/ai/characters", {
                method: "POST",
                body: JSON.stringify({
                    name: characterName.trim(),
                    description: prompt.trim(),
                    negativePrompt: negativePrompt.trim(),
                }),
            });

            setGeneratedCharacter(generated);
            setMessage(
                "Character generated. Review it, then save it to this instance."
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
            setPanelMessage("Open an instance first.");
            return;
        }

        if (activeInstance.characters.length === 0) {
            setPanelMessage("Save a character first.");
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
        setPanelMessage("Generating manga panel...");
        setGeneratedPanel(null);

        try {
            const generated = await api<GeneratedImage>("/api/ai/manga", {
                method: "POST",
                body: JSON.stringify({
                    instanceId: activeInstance.id,
                    prompt: scenePrompt.trim(),
                    characterIds: selectedCharacterIds,
                }),
            });

            setGeneratedPanel(generated);
            setPanelMessage(
                "Panel generated. Save it to store it in this instance."
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
            setPanelMessage("Manga panel saved.");
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

    return (
        <div className="app">
            <header className="header">
                <div>
                    <h1>MAGEN</h1>
                    <p>AI Manga Creation Studio</p>
                </div>

                <button
                    className="secondary-button"
                    onClick={goToDashboard}
                >
                    Dashboard
                </button>
            </header>

            <main className="workspace">
                {page === "dashboard" && (
                    <section className="dashboard">
                        <h2>Your manga projects</h2>
                        <p>
                            Each instance stores its own characters and panels.
                        </p>

                        <div className="form-card">
                            <h3>Create a new instance</h3>

                            <label htmlFor="instanceName">
                                Manga instance name
                            </label>

                            <input
                                id="instanceName"
                                value={instanceName}
                                onChange={(event) =>
                                    setInstanceName(event.target.value)
                                }
                                placeholder="e.g. The Shadow Warrior"
                            />

                            <button
                                className="generate-button"
                                onClick={createInstance}
                                disabled={loading}
                            >
                                {loading ? "Creating..." : "Create Instance"}
                            </button>

                            {message && (
                                <p className="helper" role="status">
                                    {message}
                                </p>
                            )}
                        </div>

                        <section className="instance-list">
                            <h3>Existing instances</h3>

                            {instances.length === 0 ? (
                                <p className="empty-state">
                                    No instances yet. Create your first project.
                                </p>
                            ) : (
                                <div className="instance-grid">
                                    {instances.map((instance) => (
                                        <button
                                            key={instance.id}
                                            className="instance-card"
                                            onClick={() =>
                                                void openInstance(instance.id)
                                            }
                                        >
                                            <h4>{instance.name}</h4>
                                            <p>
                                                {instance.characterCount} characters
                                            </p>
                                            <p>
                                                {instance.panelCount} manga panels
                                            </p>
                                            <span>Open project →</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    </section>
                )}

                {page !== "dashboard" && activeInstance && (
                    <>
                        <section className="instance-heading">
                            <button
                                className="text-button"
                                onClick={goToDashboard}
                            >
                                ← All instances
                            </button>

                            <h2>{activeInstance.name}</h2>
                            <p>
                                {activeInstance.characters.length} saved
                                characters · {activeInstance.panels.length} saved
                                panels
                            </p>
                        </section>

                        <nav className="workspace-nav">
                            {(
                                [
                                    ["instance", "Overview"],
                                    ["characters", "Character Creation"],
                                    ["manga", "Manga Generation"],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    className={
                                        page === value
                                            ? "nav-button active"
                                            : "nav-button"
                                    }
                                    onClick={() => setPage(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </nav>

                        {page === "instance" && (
                            <section className="instance-overview">
                                <div className="overview-grid">
                                    <article className="overview-card">
                                        <h3>Characters</h3>
                                        <p className="stat-number">
                                            {activeInstance.characters.length}
                                        </p>
                                        <p>Saved character references.</p>
                                        <button
                                            className="generate-button"
                                            onClick={() => setPage("characters")}
                                        >
                                            Create Character
                                        </button>
                                    </article>

                                    <article className="overview-card">
                                        <h3>Manga panels</h3>
                                        <p className="stat-number">
                                            {activeInstance.panels.length}
                                        </p>
                                        <p>Panels saved in this project.</p>
                                        <button
                                            className="generate-button"
                                            onClick={() => setPage("manga")}
                                        >
                                            Generate Manga
                                        </button>
                                    </article>
                                </div>

                                <h3>Saved characters</h3>

                                {activeInstance.characters.length === 0 ? (
                                    <p className="empty-state">
                                        No saved characters yet.
                                    </p>
                                ) : (
                                    <div className="character-grid">
                                        {activeInstance.characters.map(
                                            (character) => (
                                                <article
                                                    className="character-card"
                                                    key={character.id}
                                                >
                                                    <img
                                                        src={imageSource(character.image)}
                                                        alt={character.name}
                                                    />
                                                    <h4>{character.name}</h4>
                                                    <p>{character.description}</p>
                                                </article>
                                            )
                                        )}
                                    </div>
                                )}

                                <h3>Saved manga panels</h3>

                                {activeInstance.panels.length === 0 ? (
                                    <p className="empty-state">
                                        No manga panels saved yet.
                                    </p>
                                ) : (
                                    <div className="panel-grid">
                                        {activeInstance.panels.map((panel) => (
                                            <article
                                                className="panel-card"
                                                key={panel.id}
                                            >
                                                <img
                                                    src={imageSource(panel.image)}
                                                    alt={panel.prompt}
                                                />
                                                <p>{panel.prompt}</p>
                                                <small>
                                                    Characters:{" "}
                                                    {panel.characters.join(", ")}
                                                </small>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {page === "characters" && (
                            <section className="form-card">
                                <h2>Character Creation</h2>
                                <p>
                                    Create a reference for{" "}
                                    <strong>{activeInstance.name}</strong>.
                                </p>

                                <label htmlFor="characterName">
                                    Character name
                                </label>
                                <input
                                    id="characterName"
                                    value={characterName}
                                    onChange={(event) =>
                                        setCharacterName(event.target.value)
                                    }
                                    placeholder="Enter character name"
                                />

                                <label htmlFor="prompt">Positive prompt</label>
                                <textarea
                                    id="prompt"
                                    value={prompt}
                                    onChange={(event) =>
                                        setPrompt(event.target.value)
                                    }
                                    placeholder="Describe appearance, hair, eyes, clothing, body type, and art style..."
                                    rows={6}
                                />

                                <label htmlFor="negativePrompt">
                                    Negative prompt
                                </label>
                                <textarea
                                    id="negativePrompt"
                                    value={negativePrompt}
                                    onChange={(event) =>
                                        setNegativePrompt(event.target.value)
                                    }
                                    rows={4}
                                />

                                <div className="button-row">
                                    <button
                                        className="generate-button"
                                        onClick={() => void generateCharacter()}
                                        disabled={loading}
                                    >
                                        {loading
                                            ? "Generating..."
                                            : "Generate Character"}
                                    </button>

                                    <button
                                        className="secondary-button"
                                        onClick={resetCharacterForm}
                                        disabled={loading}
                                    >
                                        Reset
                                    </button>
                                </div>

                                {message && (
                                    <p className="helper" role="status">
                                        {message}
                                    </p>
                                )}

                                {generatedCharacter && (
                                    <section className="generated-character">
                                        <h3>Generated character preview</h3>
                                        <img
                                            className="generated-image"
                                            src={generatedCharacter.image}
                                            alt={`Generated character: ${characterName}`}
                                        />
                                        <p>{characterName}</p>
                                        <button
                                            className="generate-button"
                                            onClick={() => void saveCharacter()}
                                            disabled={loading}
                                        >
                                            Save Character to Instance
                                        </button>
                                    </section>
                                )}
                            </section>
                        )}

                        {page === "manga" && (
                            <section className="form-card">
                                <h2>Manga Generation</h2>
                                <p>
                                    Select saved characters from{" "}
                                    <strong>{activeInstance.name}</strong>.
                                </p>

                                <h3>Select characters</h3>

                                {activeInstance.characters.length === 0 ? (
                                    <p className="empty-state">
                                        Save a character before generating a panel.
                                    </p>
                                ) : (
                                    <div className="character-grid">
                                        {activeInstance.characters.map(
                                            (character) => (
                                                <label
                                                    className="select-character"
                                                    key={character.id}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCharacterIds.includes(
                                                            character.id
                                                        )}
                                                        onChange={() =>
                                                            toggleCharacterSelection(
                                                                character.id
                                                            )
                                                        }
                                                    />
                                                    <img
                                                        src={imageSource(character.image)}
                                                        alt={character.name}
                                                    />
                                                    <span>{character.name}</span>
                                                </label>
                                            )
                                        )}
                                    </div>
                                )}

                                <label htmlFor="scenePrompt">
                                    Scene description
                                </label>
                                <textarea
                                    id="scenePrompt"
                                    value={scenePrompt}
                                    onChange={(event) =>
                                        setScenePrompt(event.target.value)
                                    }
                                    placeholder="Describe the action, setting, emotion, camera angle, and composition..."
                                    rows={6}
                                />

                                <button
                                    className="generate-button"
                                    onClick={() => void generateMangaPanel()}
                                    disabled={
                                        panelLoading ||
                                        activeInstance.characters.length === 0
                                    }
                                >
                                    {panelLoading
                                        ? "Generating..."
                                        : "Generate Manga Panel"}
                                </button>

                                {panelMessage && (
                                    <p className="helper" role="status">
                                        {panelMessage}
                                    </p>
                                )}

                                {generatedPanel && (
                                    <section className="generated-character">
                                        <h3>Generated manga panel</h3>
                                        <img
                                            className="generated-image"
                                            src={generatedPanel.image}
                                            alt="Generated manga panel"
                                        />
                                        <button
                                            className="generate-button"
                                            onClick={() => void saveMangaPanel()}
                                            disabled={panelLoading}
                                        >
                                            Save Panel to Instance
                                        </button>
                                    </section>
                                )}
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;