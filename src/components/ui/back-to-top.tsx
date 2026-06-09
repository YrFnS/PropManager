'use client';

import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, RefObject } from 'react';
import { Button } from '@/components/ui/button';

interface BackToTopProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
  threshold?: number;
}

export default function BackToTop({ scrollContainerRef, threshold = 300 }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setVisible(container.scrollTop > threshold);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, threshold]);

  const scrollToTop = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 end-6 z-30"
        >
          <Button
            size="icon"
            onClick={scrollToTop}
            className="h-10 w-10 rounded-full shadow-lg"
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
