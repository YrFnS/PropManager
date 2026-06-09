'use client';

import { useAppStore } from '@/lib/store';
import { useTranslations, useLocale } from 'next-intl';
import { Sparkles, Send, Trash2, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AICopilot() {
  const { aiCopilotOpen, setAiCopilotOpen } = useAppStore();
  const locale = useLocale();
  const t = useTranslations('common');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRtl = locale === 'ar';

  const suggestedQuestions = [
    t('occupancyRate'),
    t('overduePayments'),
    t('expiringLeases'),
    t('urgentMaintenance'),
    t('revenueSummary'),
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when sheet opens
  useEffect(() => {
    if (aiCopilotOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [aiCopilotOpen]);

  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });

        const data = await res.json();

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response || 'Sorry, I could not process your request.',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered a network error. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Welcome message when chat is empty
  const showWelcome = messages.length === 0 && !isLoading;

  return (
    <Sheet open={aiCopilotOpen} onOpenChange={setAiCopilotOpen}>
      <SheetContent
        side={isRtl ? 'left' : 'right'}
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">
                  {t('aiCopilot')}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {t('aiCopilotDescription')}
                </SheetDescription>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={clearChat}
                title={t('clearChat')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
          style={{ maxHeight: 'calc(100vh - 240px)' }}
        >
          {/* Welcome state */}
          {showWelcome && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-600/20 mb-4">
                <Bot className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{t('aiCopilot')}</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px]">
                {t('aiCopilotDescription')}
              </p>

              {/* Suggested questions */}
              <div className="w-full space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('suggestedQuestions')}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(question)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:border-primary/30 transition-colors duration-150 text-muted-foreground hover:text-foreground"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat messages */}
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5"
            >
              <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Suggestion chips (shown when chat is active) */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 pb-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              {suggestedQuestions.slice(0, 3).map((question, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(question)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent transition-colors duration-150 text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-3 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('typeYourQuestion')}
              disabled={isLoading}
              className="flex-1 h-10 text-sm"
              dir={isRtl ? 'rtl' : 'ltr'}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 shrink-0 bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
