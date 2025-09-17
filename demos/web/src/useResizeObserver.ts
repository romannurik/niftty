import { useEffect, useState } from "react";

export function useResizeObserver(
  onResize: () => void,
  node: HTMLElement | undefined | null,
  deps: any[]
) {
  const [resizeObserver, setResizeObserver] = useState<ResizeObserver>();

  useEffect(() => {
    let observer = new ResizeObserver(() => onResize());
    setResizeObserver(observer);
    return () => observer.disconnect();
  }, deps);

  useEffect(() => {
    if (!node || !resizeObserver) return;
    resizeObserver.observe(node);
    return () => resizeObserver.unobserve(node);
  }, [resizeObserver, node, ...deps]);
}
