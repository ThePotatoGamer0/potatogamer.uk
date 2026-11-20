import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { QuietState } from "./QuietState";

export function Toast({ toast }: { toast: { kind: "ok" | "err"; text: string } | null }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status">
      {toast.text}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback((kind: "ok" | "err", text: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast({ kind, text });
    timer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return { toast, show };
}

interface BoundaryProps {
  title: string;
  children: ReactNode;
}

interface BoundaryState {
  error: string | null;
}

export class CardBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error: error.message || "Something broke in this card." };
  }

  componentDidCatch(error: Error) {
    console.error(`[card:${this.props.title}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="card">
          <h2>{this.props.title}</h2>
          <QuietState>This card hit an error.</QuietState>
        </section>
      );
    }
    return this.props.children;
  }
}
