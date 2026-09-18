"use client";
import { cn } from "@/lib/utils";

export function TextShimmerWave({
  children,
  // eslint-disable-next-line no-unused-vars
  as: Component = "p",
  className,
  duration = 1,
  baseColor,
  shimmerColor,
  zDistance = 10,
  xDistance = 2,
  yDistance = -2,
  spread = 1,
  scaleDistance = 1.1,
  rotateYDistance = 10,
  style
}) {
  const chars = children.split("");

  return (
    <Component
      className={cn("relative inline-block perspective-normal", className)}
      style={
        {
          ...style,
          "--tw-shimmer-duration": `${duration}s`,
          "--tw-shimmer-spread": spread,
          "--tw-z-distance": `${zDistance}px`,
          "--tw-x-distance": `${xDistance}px`,
          "--tw-y-distance": `${yDistance}px`,
          "--tw-scale-distance": scaleDistance,
          "--tw-rotate-y-distance": `${rotateYDistance}deg`,
          "--base-color":
            baseColor ?? "color-mix(in oklab, currentColor 55%, transparent)",
          "--base-gradient-color": shimmerColor ?? "currentColor",
          perspective: "800px"
        }
      }>
      {chars.map((char, i) => {
        const delay = (i * duration * (1 / spread)) / chars.length;

        return (
          <span
            key={i}
            className={cn("inline-block whitespace-pre transform-3d tw-shimmer-char")}
            style={{
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              color: "var(--base-color)",
              animationName: "tw-shimmer-wave",
              display: "inline-block",
              transformStyle: "preserve-3d"
            }}>
            {char}
          </span>
        );
      })}
    </Component>
  );
}
