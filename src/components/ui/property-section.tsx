import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PropertySectionProps {
  title: string;
  /** Whether the section starts expanded. Default true. */
  defaultOpen?: boolean;
  /**
   * When true and the section is collapsed, show a small emerald dot in the
   * header to signal it holds a non-default value worth a glance. Uses an
   * explicit color because the theme's accent/muted/secondary tokens are all
   * the same value and can't stand out on their own.
   */
  dot?: boolean;
  /** Optional right-aligned header slot (e.g. a count) shown when expanded. */
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A quiet, collapsible property group. Replaces the app's `border-b`-divided
 * sections with whitespace + an uppercase-muted header, per the "Soft Modern"
 * layout direction. The body animates open/closed with framer-motion; if that
 * ever thrashes against the Konva/Three canvas it can degrade to a plain
 * conditional render with no API change.
 */
export function PropertySection({
  title,
  defaultOpen = true,
  dot = false,
  trailing,
  className,
  children,
}: PropertySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('px-2', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform',
            open ? '' : '-rotate-90',
          )}
        />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
          {title}
        </span>
        {open
          ? trailing && <span className="ml-auto">{trailing}</span>
          : dot && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-2 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
