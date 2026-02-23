export function attachScrollSync(fixed?: HTMLElement | null, scroll?: HTMLElement | null) {
  if (!fixed || !scroll) return;
  let syncing = false;
  const syncFromFixed = () => {
    if (syncing) return; syncing = true; scroll.scrollTop = fixed.scrollTop; syncing = false;
  };
  const syncFromScroll = () => {
    if (syncing) return; syncing = true; fixed.scrollTop = scroll.scrollTop; syncing = false;
  };
  fixed.addEventListener('scroll', syncFromFixed, { passive: true });
  scroll.addEventListener('scroll', syncFromScroll, { passive: true });
  return () => {
    fixed.removeEventListener('scroll', syncFromFixed);
    scroll.removeEventListener('scroll', syncFromScroll);
  };
}
