// Shared Motion (motion.dev) building blocks: staggered lists, hover lift, page fade.
// <MotionConfig reducedMotion="user"> in __root turns all of this off for people who ask
// their system to reduce motion.
import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

type ListTag = "div" | "ul" | "ol";
type ItemTag = "div" | "li" | "article";

/** A list whose children appear one after another. */
export function Stagger({
  as = "div",
  className,
  children,
  ...rest
}: {
  as?: ListTag;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  role?: string;
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={container} initial="hidden" animate="show" {...rest}>
      {children}
    </Tag>
  );
}

/** One child of a <Stagger>; `lift` raises it slightly on hover. */
export function StaggerItem({
  as = "div",
  className,
  lift = false,
  children,
  ...rest
}: {
  as?: ItemTag;
  className?: string;
  lift?: boolean;
  children: ReactNode;
  [data: `data-${string}`]: unknown;
  onMouseEnter?: () => void;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={item}
      {...(lift
        ? { whileHover: { y: -4, transition: { type: "spring", stiffness: 400, damping: 22 } } }
        : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Fades and slides each page in when the route changes. */
export function PageFade({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
