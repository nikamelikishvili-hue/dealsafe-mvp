# Accessible form validation

Dealivra now has a reusable field-error primitive for validation failures that belong to one form control.

## Contract

- Invalid controls expose `aria-invalid="true"`.
- Help and error text are connected with `aria-describedby`.
- Field errors use assertive live-region semantics.
- Decorative error icons stay hidden from assistive technology.
- When custom validation blocks submission, focus returns to the first control that needs correction.
- Error state clears as the user edits the affected value.

## Initial rollout

The password-recovery flow validates the full password policy before making a network request and reports password mismatch on the confirmation field. Both failures focus the exact field that needs correction.

This primitive is intentionally separate from page-level feedback. Service failures remain in the shared `FeedbackMessage` component because they describe the operation rather than one field.
