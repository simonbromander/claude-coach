<script lang="ts">
  import CloudApp from "$lib/CloudApp.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  async function persist(payload: { changes: unknown; completed: Record<string, boolean> }) {
    const res = await fetch(`/api/changes/${data.planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to sync changes");
    }
  }
</script>

<svelte:head>
  <title>{data.plan?.meta?.event ?? "Training Plan"}</title>
</svelte:head>

{#if data.error}
  <div class="error">{data.error}</div>
{:else if !data.plan}
  <div class="error">Plan not found.</div>
{:else}
  <CloudApp
    plan={data.plan}
    initialChanges={data.changes}
    initialCompleted={data.completed}
    onPersist={persist}
  />
{/if}

<style>
  .error {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0d1117;
    color: #f85149;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
</style>
