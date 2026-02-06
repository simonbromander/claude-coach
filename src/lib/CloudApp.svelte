<script lang="ts">
  import "../viewer/styles.css";
  import Sidebar from "../viewer/components/Sidebar.svelte";
  import WeeksContainer from "../viewer/components/WeeksContainer.svelte";
  import WorkoutModal from "../viewer/components/WorkoutModal.svelte";
  import SettingsModal from "../viewer/components/SettingsModal.svelte";
  import ImportHelpModal from "../viewer/components/ImportHelpModal.svelte";
  import type { TrainingDay, TrainingPlan, Workout } from "../schema/training-plan.js";
  import type { Settings } from "./settings-core.js";
  import type { PlanChanges } from "./plan-changes.js";
  import { generateWorkoutId } from "./plan-changes.js";
  import {
    loadChangesForPlan,
    loadCompletedForPlan,
    loadSettingsForPlan,
    saveChangesForPlan,
    saveCompletedForPlan,
    saveSettingsForPlan,
  } from "./cloud/storage.js";

  interface PersistPayload {
    changes: PlanChanges;
    completed: Record<string, boolean>;
  }

  interface Props {
    plan: TrainingPlan;
    initialChanges?: PlanChanges | null;
    initialCompleted?: Record<string, boolean> | null;
    onPersist?: (payload: PersistPayload) => Promise<void> | void;
  }

  let { plan, initialChanges = null, initialCompleted = null, onPersist }: Props = $props();

  const planId = $derived(plan.meta?.id ?? "plan");

  $effect(() => {
    if (!plan.meta) plan.meta = { id: planId };
    if (!plan.meta.id) plan.meta.id = planId;
  });

  // Reactive state
  let settings = $state<Settings>(loadSettingsForPlan(plan));
  let completed = $state(loadCompletedForPlan(planId, initialCompleted ?? undefined));
  let changes = $state(loadChangesForPlan(planId, initialChanges ?? undefined));
  let filters = $state({ sport: "all", status: "all" });
  let sidebarOpen = $state(false);
  let settingsOpen = $state(false);
  let importHelpOpen = $state(false);

  let syncing = $state(false);
  let syncError = $state<string | null>(null);
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  // First-change banner state
  const bannerKey = `plan-${planId}-banner-dismissed`;
  let showBanner = $state(false);

  function triggerBanner() {
    if (localStorage.getItem(bannerKey) !== "true") {
      showBanner = true;
    }
  }

  function dismissBanner() {
    showBanner = false;
    localStorage.setItem(bannerKey, "true");
  }

  // Workout modal state
  type ModalState =
    | { mode: "view"; workout: Workout; day: TrainingDay }
    | { mode: "create"; day: TrainingDay }
    | null;

  let modalState = $state<ModalState>(null);

  // Apply theme to document
  $effect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  });

  // Apply completed state to plan workouts
  $effect(() => {
    plan.weeks?.forEach((week) => {
      week.days?.forEach((day) => {
        day.workouts?.forEach((w) => {
          w.completed = !!completed[w.id];
        });
      });
    });
  });

  function handleSettingsChange(newSettings: Settings) {
    settings = newSettings;
    saveSettingsForPlan(planId, newSettings);
  }

  function schedulePersist() {
    saveChangesForPlan(planId, changes);
    saveCompletedForPlan(planId, completed);

    if (!onPersist) return;

    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      syncing = true;
      syncError = null;
      try {
        await onPersist({ changes, completed });
      } catch (e) {
        syncError = e instanceof Error ? e.message : "Failed to sync changes";
      } finally {
        syncing = false;
      }
    }, 500);
  }

  function handleToggleComplete(workoutId: string) {
    if (completed[workoutId]) {
      delete completed[workoutId];
      completed = { ...completed };
    } else {
      completed = { ...completed, [workoutId]: true };
    }
    schedulePersist();
    triggerBanner();
  }

  function handleWorkoutClick(workout: Workout, day: TrainingDay) {
    modalState = { mode: "view", workout, day };
  }

  function handleAddWorkout(day: TrainingDay) {
    modalState = { mode: "create", day };
  }

  function handleCloseModal() {
    modalState = null;
  }

  // Change handlers
  function handleWorkoutMove(workoutId: string, originalDate: string, newDate: string) {
    if (originalDate === newDate) {
      // Moving back to original - remove the move
      delete changes.moved[workoutId];
    } else {
      changes.moved[workoutId] = newDate;
    }
    changes = { ...changes };
    schedulePersist();
    triggerBanner();
  }

  function handleWorkoutSave(updates: Partial<Workout>) {
    if (!modalState) return;

    if (modalState.mode === "create") {
      // Create new workout
      const id = generateWorkoutId();
      const fullWorkout: Workout = {
        id,
        sport: updates.sport || "run",
        type: updates.type || "endurance",
        name: updates.name || "Workout",
        description: updates.description || "",
        durationMinutes: updates.durationMinutes,
        distanceMeters: updates.distanceMeters,
        primaryZone: updates.primaryZone,
        humanReadable: updates.humanReadable,
        completed: false,
      };
      changes.added[id] = { date: modalState.day.date, workout: fullWorkout };
      changes = { ...changes };
      schedulePersist();
      triggerBanner();
      modalState = null;
    } else {
      // Edit existing workout
      const workoutId = modalState.workout.id;

      // Check if it's a user-added workout
      if (changes.added[workoutId]) {
        // Update the added workout directly
        changes.added[workoutId].workout = {
          ...changes.added[workoutId].workout,
          ...updates,
        };
      } else {
        // Store edits as overlay
        changes.edited[workoutId] = { ...(changes.edited[workoutId] || {}), ...updates };
      }
      changes = { ...changes };
      schedulePersist();
      triggerBanner();

      // Update the modal state with the new workout data
      modalState = {
        ...modalState,
        workout: { ...modalState.workout, ...updates },
      };
    }
  }

  function handleWorkoutDelete(workoutId: string) {
    // Check if it's a user-added workout
    if (changes.added[workoutId]) {
      // Remove from added
      delete changes.added[workoutId];
    } else {
      // Mark as deleted
      if (!changes.deleted.includes(workoutId)) {
        changes.deleted = [...changes.deleted, workoutId];
      }
    }
    changes = { ...changes };
    schedulePersist();
    triggerBanner();
    modalState = null;
  }
</script>

{#if showBanner}
  <div class="local-storage-banner">
    <div class="banner-content">
      <span class="banner-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </span>
      <p>
        Your changes are saved locally and synced to the cloud. You can export a backup from
        Settings any time.
      </p>
      <button class="banner-close" onclick={dismissBanner} aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

{#if syncing || syncError}
  <div class="sync-status {syncError ? 'error' : ''}">
    {#if syncError}
      Sync failed. Changes are still saved locally.
    {:else}
      Syncing...
    {/if}
  </div>
{/if}

<div class="app">
  <Sidebar
    {plan}
    {settings}
    {filters}
    {completed}
    bind:open={sidebarOpen}
    onFilterChange={(f) => (filters = f)}
    onSettingsClick={() => (settingsOpen = true)}
    onImportHelpClick={() => (importHelpOpen = true)}
  />

  <main class="main-content">
    <div class="mobile-header">
      <button class="menu-toggle" onclick={() => (sidebarOpen = !sidebarOpen)}>☰</button>
      <h2 class="mobile-title">{plan.meta?.event ?? "Training Plan"}</h2>
    </div>

    <WeeksContainer
      {plan}
      {settings}
      {filters}
      {completed}
      {changes}
      onWorkoutClick={handleWorkoutClick}
      onWorkoutMove={handleWorkoutMove}
      onAddWorkout={handleAddWorkout}
    />
  </main>
</div>

{#if modalState}
  <WorkoutModal
    workout={modalState.mode === "view" ? modalState.workout : null}
    day={modalState.day}
    mode={modalState.mode}
    isCompleted={modalState.mode === "view" && !!completed[modalState.workout.id]}
    {settings}
    onClose={handleCloseModal}
    onToggleComplete={handleToggleComplete}
    onSave={handleWorkoutSave}
    onDelete={handleWorkoutDelete}
    onImportHelpClick={() => (importHelpOpen = true)}
  />
{/if}

{#if settingsOpen}
  <SettingsModal
    {settings}
    onClose={() => (settingsOpen = false)}
    onChange={handleSettingsChange}
    onOpenImportHelp={() => (importHelpOpen = true)}
  />
{/if}

{#if importHelpOpen}
  <ImportHelpModal onClose={() => (importHelpOpen = false)} />
{/if}

<style>
  .local-storage-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-medium);
    padding: 0.75rem 1rem;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .banner-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .banner-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    color: var(--accent);
  }

  .banner-icon svg {
    width: 100%;
    height: 100%;
  }

  .banner-content p {
    flex: 1;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .banner-close {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--border-medium);
    background: transparent;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .banner-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .banner-close svg {
    width: 14px;
    height: 14px;
  }

  .sync-status {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 1000;
    background: var(--bg-secondary);
    border: 1px solid var(--border-medium);
    color: var(--text-secondary);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .sync-status.error {
    border-color: #f85149;
    color: #f85149;
  }

  .main-content {
    flex: 1;
    margin-left: var(--sidebar-width);
    padding: 2rem;
  }

  .mobile-header {
    display: none;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .menu-toggle {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-medium);
    color: var(--text-primary);
    font-size: 1.2rem;
  }

  .mobile-title {
    font-size: 1.1rem;
    font-weight: 600;
  }

  @media (max-width: 700px) {
    .main-content {
      margin-left: 0;
      padding: 1rem;
    }

    .mobile-header {
      display: flex;
    }
  }
</style>
