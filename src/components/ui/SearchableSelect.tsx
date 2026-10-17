'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  required?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  emptyMessage = 'No matching options found.',
  required = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 250ms debounce on search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setDebouncedSearch('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value]
  );

  // Filtered options (supports multi-term search and displays all items up to 250)
  const filteredOptions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) {
      return options.length <= 250 ? options : options.slice(0, 250);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const filtered = options.filter((opt) => {
      const label = opt.label.toLowerCase();
      const sublabel = (opt.sublabel || '').toLowerCase();
      return tokens.every((token) => label.includes(token) || sublabel.includes(token));
    });
    return filtered.length <= 250 ? filtered : filtered.slice(0, 250);
  }, [options, searchTerm]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-50 dark:bg-[#1f150c] border border-slate-300 dark:border-[#4d3817] rounded-[3px] px-3 py-2 text-left transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:border-amber-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100/80 dark:hover:bg-[#281b0f] cursor-pointer'
        } ${isOpen ? 'ring-1 ring-amber-500 border-amber-500 dark:border-amber-500' : ''}`}
      >
        <span className={`truncate ${selectedOption ? 'font-semibold text-slate-900 dark:text-[#faebd0]' : 'text-slate-400 dark:text-[#8a7251]'}`}>
          {selectedOption ? (
            <span>
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="ml-1.5 font-normal text-slate-500 dark:text-[#bda88c]">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-[#8a7251] transition-transform shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
          }`}
        />
      </button>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-[#1a1309] rounded-[3px] border border-slate-200 dark:border-[#4d3817] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-[#382713] bg-slate-50/70 dark:bg-[#22180e] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#8a7251] shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-[#faebd0] focus:outline-none placeholder:text-slate-400 dark:placeholder:text-[#8a7251]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-0.5 text-slate-400 dark:text-[#8a7251] hover:text-slate-600 dark:hover:text-[#faebd0] rounded-[2px]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-[#2e1f0e] p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-400 dark:text-[#8a7251] text-xs">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[3px] text-left transition-colors text-xs ${
                      isSelected
                        ? 'bg-bce-navy text-amber-400 dark:bg-[#342414] dark:text-amber-300 font-bold'
                        : 'text-slate-800 dark:text-[#faebd0] hover:bg-slate-100 dark:hover:bg-[#251b0f]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="block truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span
                          className={`block text-[11px] truncate ${
                            isSelected ? 'text-amber-300/80' : 'text-slate-400 dark:text-[#a8906c]'
                          }`}
                        >
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                  </button>
                );
              })
            )}

            {options.length > 250 && !searchTerm && (
              <div className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-[#8a7251] text-center bg-slate-50 dark:bg-[#22180e] rounded-[3px] mt-1">
                Showing first 250 of {options.length} items. Type to search all.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
