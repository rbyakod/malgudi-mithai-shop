"use client";

import {usePathname} from "next/navigation";
import {Button, useConfig, useDocumentInfo, useEditDepth} from "@payloadcms/ui";
import {formatAdminURL} from "payload/shared";

// "Cancel" for every admin edit view — collections (create + edit) and
// globals. Injected via payload.config.ts:
//   collections -> admin.components.edit.beforeDocumentControls
//   globals     -> admin.components.elements.beforeDocumentControls
// (Payload renders that slot FIRST in the DocumentControls row, i.e.
// immediately left of Save/Publish.)
//
// Targets: collection -> its list view; global -> dashboard (a global's
// route IS its edit view, there is no list). Dirty forms are protected
// for free: Payload's LeaveWithoutSaving guard is a capture-phase
// document click listener that reads the anchor href and opens the
// styled "Leave anyway" modal before any navigation runs.
//
// NOT rendered on /admin/account: Payload's AccountView renders
// EditView -> DefaultEditView without renderDocumentSlots, so it never
// consumes beforeDocumentControls (verified against 3.87.1 internals).
// Giving the account view a Cancel would mean replacing the whole view
// via admin.components.views.account — not worth it for a profile form.
export function CancelAction() {
  const {config} = useConfig();
  const {collectionSlug, globalSlug} = useDocumentInfo();
  const editDepth = useEditDepth();

  // Nested document views (relationship "create new" drawer) own their
  // close control; a page-level Cancel would navigate underneath them.
  if (editDepth > 1) return null;
  if (!collectionSlug && !globalSlug) return null;

  // Shape required by formatAdminURL's path param ('' | `/${string}`).
  const path: "" | `/${string}` = globalSlug
    ? ""
    : collectionSlug
      ? `/collections/${collectionSlug}`
      : "";

  return (
    <Button
      el="link"
      to={formatAdminURL({adminRoute: config.routes.admin, path})}
      buttonStyle="secondary"
      margin={false}
    >
      Cancel
    </Button>
  );
}

export default CancelAction;
