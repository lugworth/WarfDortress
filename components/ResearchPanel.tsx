"use client";

import { useState } from "react";
import type { GameState } from "@/lib/types";
import {
  createResearchState,
  RESEARCH_PROJECTS,
  researchBlockers,
} from "@/lib/research";
import type { ResearchAction } from "@/lib/research";
import { formatCost } from "@/lib/tool-catalog";

export default function ResearchPanel({
  state,
  onAction,
}: {
  state: GameState;
  onAction: (action: ResearchAction) => boolean;
}) {
  const [status, setStatus] = useState("");
  const research = state.activities?.research || createResearchState();
  return (
    <section
      aria-label="Engineering research"
      className="space-y-3 text-[var(--ui-text)]"
    >
      <p>
        One project at a time. Materials are spent when research starts.
        Completed techniques benefit the fortress permanently, once each. The
        clock must run for research to advance.
      </p>
      <p role="status" className="text-[var(--ui-info)]">
        {status}
      </p>
      {RESEARCH_PROJECTS.map((project) => {
        const done = research.completed.some(
          (item) => item.projectId === project.id,
        );
        const active =
          research.active?.projectId === project.id ? research.active : null;
        const blockers = researchBlockers(state, project.id);
        const prerequisites = [
          ...project.prerequisites.map((item) => item.label),
          ...(project.militia ? ["At least one living militia member"] : []),
        ];
        const elapsed = active
          ? Math.min(
              project.duration,
              Math.max(0, state.ticks - active.startedAt),
            )
          : 0;
        return (
          <article
            key={project.id}
            className="space-y-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3"
          >
            <h3 className="font-bold text-[var(--ui-accent)]">
              {project.title}
              {done ? " · Complete" : active ? " · In progress" : ""}
            </h3>
            <p>{project.description}</p>
            <p className="text-[var(--ui-success)]">
              Permanent effect: {project.effect}
            </p>
            <p>
              Cost: {formatCost(project.cost)} · Duration: {project.duration}{" "}
              ticks
            </p>
            <p>
              Requires:{" "}
              {prerequisites.length
                ? prerequisites.join("; ")
                : "Starting camp — no building needed"}
            </p>
            {active && (
              <div>
                <label htmlFor={`research-${project.id}`}>
                  {elapsed}/{project.duration} ticks ·{" "}
                  {Math.max(0, active.completesAt - state.ticks)} ticks
                  remaining
                </label>
                <progress
                  id={`research-${project.id}`}
                  value={elapsed}
                  max={project.duration}
                  className="block w-full"
                />
              </div>
            )}
            {!done && !active && (
              <>
                <button
                  type="button"
                  disabled={blockers.length > 0}
                  aria-label={`Start ${project.title}`}
                  aria-describedby={
                    blockers.length
                      ? `research-blockers-${project.id}`
                      : undefined
                  }
                  className="border border-[var(--ui-info)] px-3 py-2 text-[var(--ui-info)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--ui-accent)]"
                  onClick={() =>
                    setStatus(
                      onAction({
                        type: "START_RESEARCH",
                        projectId: project.id,
                      })
                        ? `${project.title} started. Resume the clock to advance research.`
                        : "Research could not start. Check materials, prerequisites, and the active project.",
                    )
                  }
                >
                  Start project
                </button>
                {blockers.length > 0 && (
                  <p
                    id={`research-blockers-${project.id}`}
                    className="text-[var(--ui-warning)]"
                  >
                    {blockers.join(" · ")}
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}
      {research.history.length > 0 && (
        <details>
          <summary>Research journal ({research.history.length})</summary>
          <ol className="mt-2 space-y-1">
            {[...research.history].reverse().map((entry, index) => (
              <li key={`${entry.projectId}-${entry.type}-${index}`}>
                Tick {entry.tick}:{" "}
                {
                  RESEARCH_PROJECTS.find(
                    (project) => project.id === entry.projectId,
                  )?.title
                }{" "}
                {entry.type === "STARTED" ? "started" : "completed"}.
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
