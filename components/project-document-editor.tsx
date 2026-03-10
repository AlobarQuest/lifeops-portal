"use client";

import { useActionState } from "react";

import {
  updateProjectDocumentAction,
  type ProjectDocumentActionState,
} from "@/app/actions/projects";

type ProjectDocumentEditorProps = {
  projectSlug: string;
  documentType: string;
  documentTitle: string;
  documentDescription: string;
  bodyMarkdown: string;
  updatedAt: string;
};

export function ProjectDocumentEditor({
  projectSlug,
  documentType,
  documentTitle,
  documentDescription,
  bodyMarkdown,
  updatedAt,
}: ProjectDocumentEditorProps) {
  const initialState: ProjectDocumentActionState = {
    status: "idle",
    message: "",
  };

  const [state, formAction, isPending] = useActionState(updateProjectDocumentAction, initialState);

  return (
    <form action={formAction} className="project-document-form">
      <input name="projectSlug" type="hidden" value={projectSlug} />
      <input name="documentType" type="hidden" value={documentType} />

      {state.status === "error" ? <div className="error-banner">{state.message}</div> : null}
      {state.status === "success" ? <div className="success-banner">{state.message}</div> : null}

      <div className="document-editor-header">
        <div>
          <h3>{documentTitle}</h3>
          <p>{documentDescription}</p>
        </div>
        <div className="document-editor-meta">
          <span className="pill">Markdown</span>
          <span className="pill">Updated {updatedAt}</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`document-${documentType}`}>Document body</label>
        <textarea
          className="document-textarea"
          defaultValue={bodyMarkdown}
          id={`document-${documentType}`}
          name="bodyMarkdown"
          spellCheck={false}
        />
      </div>

      <p className="support-text">
        Keep this document current enough that another session, person, or internal app could resume work without
        reconstructing the project context from scratch.
      </p>

      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save document"}
      </button>
    </form>
  );
}
