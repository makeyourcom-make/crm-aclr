"use client";

/**
 * Canvas de signature manuscrite — souris, doigt, ou stylet.
 *
 * Utilise les Pointer Events (couvre touch + souris + Apple Pencil/stylo).
 * Sortie : data URL PNG, accessible via la ref imperative `getDataUrl()`.
 *
 * Conçu pour fonctionner en plein écran tablette (pixel ratio géré pour
 * un rendu net sur écrans Retina / hi-DPI).
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface SignaturePadHandle {
  /** Renvoie le data URL PNG du tracé, ou null si vide. */
  getDataUrl: () => string | null;
  /** Efface tout le tracé. */
  clear: () => void;
  /** True si le canvas n'est pas vide. */
  hasInk: () => boolean;
}

interface SignaturePadProps {
  /** Hauteur visuelle du pad en px. La largeur est 100 %. */
  height?: number;
  /** Couleur du trait. */
  strokeColor?: string;
  /** Épaisseur du trait. */
  strokeWidth?: number;
  /** Callback quand le client commence/fin de signer (utile pour activer le bouton). */
  onInkChange?: (hasInk: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      height = 180,
      strokeColor = "#0E1936",
      strokeWidth = 2.2,
      onInkChange,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    // Gestion du device pixel ratio pour un rendu net sur écrans hi-DPI
    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
    };

    useEffect(() => {
      setupCanvas();
      const handleResize = () => setupCanvas();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strokeColor, strokeWidth]);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      lastPoint.current = getPoint(e);
      // Petit point initial pour les très brefs taps
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && lastPoint.current) {
        ctx.beginPath();
        ctx.arc(
          lastPoint.current.x,
          lastPoint.current.y,
          strokeWidth / 2,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = strokeColor;
        ctx.fill();
      }
      if (!hasInk) {
        setHasInk(true);
        onInkChange?.(true);
      }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !lastPoint.current) return;
      const p = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPoint.current = p;
    };

    const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDrawing.current = false;
      lastPoint.current = null;
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Reset complet (dimensions = clear)
      const w = canvas.width;
      const h = canvas.height;
      canvas.width = w;
      canvas.height = h;
      setupCanvas();
      setHasInk(false);
      onInkChange?.(false);
    };

    useImperativeHandle(
      ref,
      () => ({
        getDataUrl: () => {
          if (!hasInk) return null;
          return canvasRef.current?.toDataURL("image/png") ?? null;
        },
        clear,
        hasInk: () => hasInk,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [hasInk],
    );

    return (
      <div className="space-y-1.5">
        <div
          className="relative rounded-md border-2 border-dashed border-slate-300 bg-white"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            className="block h-full w-full touch-none select-none rounded-md"
            style={{ touchAction: "none" }}
          />
          {!hasInk && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
              ✍ Signe ici avec ton doigt, le stylet ou la souris
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Cette signature manuscrite est annexée au contrat.
          </p>
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Effacer
          </button>
        </div>
      </div>
    );
  },
);
