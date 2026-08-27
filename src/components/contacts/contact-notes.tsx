"use client";

import { NoteComposer } from "./note-composer";
import { addContactNote } from "@/server/actions/contacts";

export function ContactNotes({ contactId }: { contactId: string }) {
  return <NoteComposer onSubmit={(content) => addContactNote(contactId, content)} />;
}
