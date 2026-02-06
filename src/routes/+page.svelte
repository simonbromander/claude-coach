<script lang="ts">
  import { goto } from "$app/navigation";

  let file = $state<File | null>(null);
  let uploading = $state(false);
  let error = $state<string | null>(null);

  async function handleUpload() {
    if (!file) return;

    uploading = true;
    error = null;

    try {
      const text = await file.text();
      const plan = JSON.parse(text);

      const planId = plan.meta?.id || `plan-${Date.now()}`;
      plan.meta = { ...plan.meta, id: planId };

      const res = await fetch(`/api/plan/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) throw new Error("Failed to upload plan");

      goto(`/plan/${planId}`);
    } catch (e: any) {
      error = e.message || "Failed to upload plan";
    } finally {
      uploading = false;
    }
  }
</script>

<svelte:head>
  <title>Claude Coach</title>
</svelte:head>

<div class="container">
  <div class="card">
    <h1>Claude Coach</h1>
    <p class="subtitle">Upload a training plan to get started</p>

    <div class="upload">
      <input
        type="file"
        accept=".json"
        id="file-input"
        onchange={(e) => (file = e.currentTarget.files?.[0] || null)}
      />
      <label for="file-input" class="file-label">
        {file ? file.name : "Choose plan.json file"}
      </label>

      <button onclick={handleUpload} disabled={!file || uploading} class="button">
        {uploading ? "Uploading..." : "Upload & View Plan"}
      </button>

      <a class="button secondary" href="/builder">Build a New Plan</a>

      {#if error}
        <p class="error">{error}</p>
      {/if}
    </div>

    <div class="info">
      <h3>Features</h3>
      <ul>
        <li>Cloud-synced workout completion</li>
        <li>Calendar subscription (auto-updates)</li>
        <li>Full workout editing and planning</li>
        <li>Works on any device</li>
      </ul>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0d1117;
  }

  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 40px;
    max-width: 500px;
    width: 100%;
    text-align: center;
  }

  h1 {
    color: #c9d1d9;
    font-size: 2rem;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #8b949e;
    margin: 0 0 32px;
  }

  .upload {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  input[type="file"] {
    display: none;
  }

  .file-label {
    padding: 16px 24px;
    background: #21262d;
    border: 2px dashed #30363d;
    border-radius: 8px;
    color: #8b949e;
    cursor: pointer;
    transition: all 0.2s;
  }

  .file-label:hover {
    border-color: #58a6ff;
    color: #c9d1d9;
  }

  .button {
    padding: 14px 24px;
    background: #238636;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .button:hover:not(:disabled) {
    background: #2ea043;
  }

  .button:disabled {
    background: #21262d;
    color: #484f58;
    cursor: not-allowed;
  }

  .button.secondary {
    background: transparent;
    border: 1px solid #30363d;
    color: #c9d1d9;
    text-decoration: none;
    text-align: center;
  }

  .button.secondary:hover {
    border-color: #58a6ff;
    color: #58a6ff;
  }

  .error {
    color: #f85149;
    margin: 0;
  }

  .info {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid #30363d;
    text-align: left;
    color: #8b949e;
  }

  .info h3 {
    color: #c9d1d9;
    margin: 0 0 12px;
    font-size: 1rem;
  }

  .info ul {
    margin: 0;
    padding-left: 20px;
    line-height: 1.8;
  }
</style>
