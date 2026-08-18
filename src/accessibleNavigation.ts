export function motionSafeScrollBehavior(
  requested: ScrollBehavior,
): ScrollBehavior {
  if (
    requested === 'smooth' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return requested;
}

export function focusPageDestination(
  id?: string,
  requestedBehavior: ScrollBehavior = 'smooth',
): void {
  const destination = document.getElementById(id || 'main-content');
  const behavior = motionSafeScrollBehavior(requestedBehavior);
  if (!destination) {
    window.scrollTo({ top: 0, behavior });
    return;
  }

  if (!destination.hasAttribute('tabindex')) {
    destination.setAttribute('tabindex', '-1');
  }
  destination.focus({ preventScroll: true });

  if (id) {
    destination.scrollIntoView({ behavior, block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior });
  }
}
