"use client";

import { NoteComposer } from "./note-composer";
import { addCompanyNote } from "@/server/actions/companies";

export function CompanyNotes({ companyId }: { companyId: string }) {
  return <NoteComposer onSubmit={(content) => addCompanyNote(companyId, content)} />;
}
