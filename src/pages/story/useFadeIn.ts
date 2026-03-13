import { useEffect, useRef } from "react";

export function useFadeIn<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("fade-visible");
          io.disconnect();
        }
      },
      { rootMargin: "-60px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
