<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  const steps = ["Access", "Strava", "Event", "Background", "Preferences", "Review"];

  let step = $state(0);
  let secret = $state("");
  let rememberSecret = $state(true);
  let statusLoading = $state(false);
  let statusError = $state<string | null>(null);
  let stravaConnected = $state(false);
  let athleteName = $state<string | null>(null);

  let event = $state({
    name: "",
    date: "",
    type: "triathlon",
    goal: "",
  });

  let athlete = $state({
    name: "",
    yearsInSport: "",
    raceHistory: "",
  });

  let constraints = $state({
    injuries: "",
    schedule: "",
    notes: "",
  });

  let preferences = $state({
    swim: "meters",
    bike: "kilometers",
    run: "kilometers",
    firstDayOfWeek: "monday",
  });

  let generating = $state(false);
  let generateError = $state<string | null>(null);

  onMount(() => {
    const saved = sessionStorage.getItem("builder_secret");
    if (saved) {
      secret = saved;
      step = 1;
      void loadStatus();
    }
  });

  async function apiFetch(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    if (secret) headers.set("x-builder-secret", secret);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(path, { ...options, headers });
  }

  async function verifySecret() {
    statusError = null;
    const res = await apiFetch("/api/builder/status");
    if (!res.ok) {
      statusError = "Invalid access secret.";
      return;
    }
    if (rememberSecret) sessionStorage.setItem("builder_secret", secret);
    step = 1;
    await loadStatus();
  }

  async function loadStatus() {
    statusLoading = true;
    statusError = null;
    try {
      const res = await apiFetch("/api/strava/status");
      if (!res.ok) throw new Error("Failed to load Strava status");
      const data = await res.json();
      stravaConnected = !!data.connected;
      athleteName = data.athlete ? `${data.athlete.firstname} ${data.athlete.lastname}` : null;
      if (!data.connected && data.reason === "missing_activity_scope") {
        statusError = "Strava needs re-authorization to access activities. Click Connect Strava.";
      }
    } catch (e) {
      statusError = e instanceof Error ? e.message : "Failed to load Strava status";
    } finally {
      statusLoading = false;
    }
  }

  async function connectStrava() {
    statusError = null;
    const res = await apiFetch("/api/strava/start");
    if (!res.ok) {
      statusError = "Failed to start Strava OAuth";
      return;
    }
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  function nextStep() {
    if (step < steps.length - 1) step += 1;
  }

  function prevStep() {
    if (step > 0) step -= 1;
  }

  async function generatePlan() {
    generateError = null;
    if (!event.name || !event.date) {
      generateError = "Event name and date are required.";
      return;
    }
    if (!stravaConnected) {
      generateError = "Connect Strava before generating a plan.";
      return;
    }

    generating = true;
    try {
      const payload = {
        event,
        athlete: {
          ...athlete,
          yearsInSport: athlete.yearsInSport ? Number(athlete.yearsInSport) : null,
        },
        constraints,
        preferences,
      };

      const res = await apiFetch("/api/builder/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate plan");
      }

      const data = await res.json();
      if (data.planId) {
        goto(`/plan/${data.planId}`);
      }
    } catch (e) {
      generateError = e instanceof Error ? e.message : "Failed to generate plan";
    } finally {
      generating = false;
    }
  }
</script>

<svelte:head>
  <title>Plan Builder</title>
</svelte:head>

<div class="builder">
  <div class="header">
    <h1>Plan Builder</h1>
    <p>Connect Strava, answer a few questions, and generate your plan.</p>
  </div>

  <div class="steps">
    {#each steps as label, index}
      <div class="step {step === index ? 'active' : step > index ? 'done' : ''}">
        <span>{index + 1}</span>
        <span>{label}</span>
      </div>
    {/each}
  </div>

  <div class="card">
    {#if step === 0}
      <h2>Access</h2>
      <p class="muted">Enter the builder access secret to continue.</p>
      <div class="field">
        <label for="access-secret">Access Secret</label>
        <input id="access-secret" type="password" bind:value={secret} placeholder="Access secret" />
      </div>
      <label class="checkbox">
        <input type="checkbox" bind:checked={rememberSecret} />
        Remember for this session
      </label>
      {#if statusError}
        <p class="error">{statusError}</p>
      {/if}
      <div class="actions">
        <button class="primary" onclick={verifySecret} disabled={!secret}>Continue</button>
      </div>
    {:else if step === 1}
      <h2>Connect Strava</h2>
      <p class="muted">We pull your last 730 days of activity history to personalize the plan.</p>
      {#if statusLoading}
        <p>Checking status…</p>
      {:else if stravaConnected}
        <div class="status success">
          Connected {#if athleteName}as {athleteName}{/if}.
        </div>
      {:else}
        <div class="status warning">Not connected yet.</div>
      {/if}
      {#if statusError}
        <p class="error">{statusError}</p>
      {/if}
      <div class="actions">
        <button onclick={connectStrava} disabled={statusLoading}>Connect Strava</button>
        <button class="primary" onclick={nextStep} disabled={!stravaConnected}>Continue</button>
      </div>
    {:else if step === 2}
      <h2>Event Details</h2>
      <div class="grid">
        <div class="field">
          <label for="event-name">Event Name</label>
          <input id="event-name" bind:value={event.name} placeholder="Ironman 70.3 Oceanside" />
        </div>
        <div class="field">
          <label for="event-date">Event Date</label>
          <input id="event-date" type="date" bind:value={event.date} />
        </div>
        <div class="field">
          <label for="event-type">Event Type</label>
          <select id="event-type" bind:value={event.type}>
            <option value="triathlon">Triathlon</option>
            <option value="half-ironman">70.3 / Half Ironman</option>
            <option value="ironman">Full Ironman</option>
            <option value="marathon">Marathon</option>
            <option value="half-marathon">Half Marathon</option>
            <option value="ultra">Ultra</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="field">
          <label for="event-goal">Goal (optional)</label>
          <input
            id="event-goal"
            bind:value={event.goal}
            placeholder="Finish strong / 1:45 target"
          />
        </div>
      </div>
      <div class="actions">
        <button onclick={prevStep}>Back</button>
        <button class="primary" onclick={nextStep} disabled={!event.name || !event.date}>
          Continue
        </button>
      </div>
    {:else if step === 3}
      <h2>Background</h2>
      <div class="grid">
        <div class="field">
          <label for="athlete-name">Athlete Name</label>
          <input id="athlete-name" bind:value={athlete.name} placeholder="Optional" />
        </div>
        <div class="field">
          <label for="athlete-years">Years in Sport</label>
          <input
            id="athlete-years"
            type="number"
            min="0"
            bind:value={athlete.yearsInSport}
            placeholder="3"
          />
        </div>
      </div>
      <div class="field">
        <label for="race-history">Race History</label>
        <textarea
          id="race-history"
          bind:value={athlete.raceHistory}
          rows="3"
          placeholder="Past races, times, experience"
        ></textarea>
      </div>
      <div class="field">
        <label for="injuries">Injuries or Health Constraints</label>
        <textarea
          id="injuries"
          bind:value={constraints.injuries}
          rows="2"
          placeholder="Anything to be careful about"
        ></textarea>
      </div>
      <div class="field">
        <label for="schedule">Schedule Constraints</label>
        <textarea
          id="schedule"
          bind:value={constraints.schedule}
          rows="2"
          placeholder="Busy days, travel, limited pool access"
        ></textarea>
      </div>
      <div class="field">
        <label for="notes">Other Notes</label>
        <textarea
          id="notes"
          bind:value={constraints.notes}
          rows="2"
          placeholder="Preferences, dislikes, focus areas"
        ></textarea>
      </div>
      <div class="actions">
        <button onclick={prevStep}>Back</button>
        <button class="primary" onclick={nextStep}>Continue</button>
      </div>
    {:else if step === 4}
      <h2>Preferences</h2>
      <div class="grid">
        <div class="field">
          <label for="pref-swim">Swim Units</label>
          <select id="pref-swim" bind:value={preferences.swim}>
            <option value="meters">Meters</option>
            <option value="yards">Yards</option>
          </select>
        </div>
        <div class="field">
          <label for="pref-bike">Bike Units</label>
          <select id="pref-bike" bind:value={preferences.bike}>
            <option value="kilometers">Kilometers</option>
            <option value="miles">Miles</option>
          </select>
        </div>
        <div class="field">
          <label for="pref-run">Run Units</label>
          <select id="pref-run" bind:value={preferences.run}>
            <option value="kilometers">Kilometers</option>
            <option value="miles">Miles</option>
          </select>
        </div>
        <div class="field">
          <label for="pref-week">First Day of Week</label>
          <select id="pref-week" bind:value={preferences.firstDayOfWeek}>
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button onclick={prevStep}>Back</button>
        <button class="primary" onclick={nextStep}>Continue</button>
      </div>
    {:else if step === 5}
      <h2>Review & Generate</h2>
      <div class="review">
        <div>
          <strong>Event:</strong>
          {event.name} — {event.date} ({event.type})
        </div>
        {#if event.goal}
          <div><strong>Goal:</strong> {event.goal}</div>
        {/if}
        {#if athlete.yearsInSport}
          <div><strong>Years in sport:</strong> {athlete.yearsInSport}</div>
        {/if}
        {#if athlete.raceHistory}
          <div><strong>Race history:</strong> {athlete.raceHistory}</div>
        {/if}
        {#if constraints.injuries}
          <div><strong>Injuries:</strong> {constraints.injuries}</div>
        {/if}
        {#if constraints.schedule}
          <div><strong>Schedule:</strong> {constraints.schedule}</div>
        {/if}
        {#if constraints.notes}
          <div><strong>Notes:</strong> {constraints.notes}</div>
        {/if}
      </div>
      {#if generateError}
        <p class="error">{generateError}</p>
      {/if}
      <div class="actions">
        <button onclick={prevStep}>Back</button>
        <button class="primary" onclick={generatePlan} disabled={generating}>
          {generating ? "Generating..." : "Generate Plan"}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0d1117;
    color: #c9d1d9;
  }

  .builder {
    max-width: 900px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  .header h1 {
    margin: 0 0 8px;
    font-size: 2.2rem;
  }

  .header p {
    margin: 0 0 24px;
    color: #8b949e;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    margin-bottom: 24px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #161b22;
    border: 1px solid #30363d;
    font-size: 0.85rem;
    color: #8b949e;
  }

  .step span:first-child {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #21262d;
    color: #8b949e;
    font-weight: 600;
  }

  .step.active {
    border-color: #58a6ff;
    color: #c9d1d9;
  }

  .step.active span:first-child {
    background: #58a6ff;
    color: #0d1117;
  }

  .step.done {
    border-color: #238636;
    color: #c9d1d9;
  }

  .step.done span:first-child {
    background: #238636;
    color: #fff;
  }

  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 32px;
  }

  h2 {
    margin-top: 0;
  }

  .muted {
    color: #8b949e;
  }

  .grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  input,
  select,
  textarea {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 10px 12px;
    color: #c9d1d9;
  }

  textarea {
    resize: vertical;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #8b949e;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  button {
    padding: 10px 16px;
    background: #21262d;
    border: 1px solid #30363d;
    color: #c9d1d9;
    border-radius: 8px;
    cursor: pointer;
  }

  button.primary {
    background: #238636;
    border-color: #238636;
    color: #fff;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status {
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .status.success {
    background: #102a1b;
    border: 1px solid #238636;
    color: #7ee787;
  }

  .status.warning {
    background: #2d2315;
    border: 1px solid #d29922;
    color: #f2cc60;
  }

  .error {
    color: #f85149;
    margin-top: 8px;
  }

  .review {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  @media (max-width: 600px) {
    .actions {
      flex-direction: column;
    }
  }
</style>
