"use client";

import { useFormStatus } from "react-dom";

import { deleteProjectAction } from "@/app/actions/projects";

type ProjectDeleteFormProps = {
  projectSlug: string;
  projectName: string;
};

function DeleteProjectButton() {
  const { pending } = useFormStatus();

  return (
    <button className="danger-button" disabled={pending} type="submit">
      {pending ? "Deleting..." : "Delete project"}
    </button>
  );
}

export function ProjectDeleteForm({
  projectSlug,
  projectName,
}: ProjectDeleteFormProps) {
  return (
    <form
      action={deleteProjectAction}
      className="danger-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete ${projectName}? This removes the project workspace and its documents. Linked tasks will stay in LifeOps but lose the project link.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="projectSlug" type="hidden" value={projectSlug} />

      <p className="support-text">
        Deleting a project removes its full document pack. Linked tasks remain in LifeOps as unassigned work so you do
        not lose execution history.
      </p>

      <DeleteProjectButton />
    </form>
  );
}
