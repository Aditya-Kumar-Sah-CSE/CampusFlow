'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import type { ExamQuestion, ExamQuestionOption } from '@/types/exams';

interface QuestionBuilderProps {
  questions: ExamQuestion[];
  onChange: (questions: ExamQuestion[]) => void;
  readOnly?: boolean;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function QuestionBuilder({ questions, onChange, readOnly = false }: QuestionBuilderProps) {
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // If no questions exist, start with 1 blank question
  if (questions.length === 0) {
    const initialQuestion: ExamQuestion = {
      id: crypto.randomUUID(),
      exam_id: '',
      question_text: '',
      explanation: '',
      marks: 1,
      difficulty: 'MEDIUM',
      topic: '',
      position: 1,
      options: [
        { id: crypto.randomUUID(), question_id: '', option_key: 'A', option_text: '', position: 1, is_correct: true },
        { id: crypto.randomUUID(), question_id: '', option_key: 'B', option_text: '', position: 2, is_correct: false },
        { id: crypto.randomUUID(), question_id: '', option_key: 'C', option_text: '', position: 3, is_correct: false },
        { id: crypto.randomUUID(), question_id: '', option_key: 'D', option_text: '', position: 4, is_correct: false },
      ],
    };
    onChange([initialQuestion]);
    return null;
  }

  const currentQ = questions[Math.min(activeIdx, questions.length - 1)];

  // Validate individual question
  const isQuestionValid = (q: ExamQuestion): { valid: boolean; reason?: string } => {
    if (!q.question_text.trim()) {
      return { valid: false, reason: 'Question text is empty' };
    }
    if (!q.options || q.options.length < 2) {
      return { valid: false, reason: 'Requires at least 2 options' };
    }
    const emptyOpt = q.options.some(o => !o.option_text.trim());
    if (emptyOpt) {
      return { valid: false, reason: 'Some options are empty' };
    }
    const correctCount = q.options.filter(o => o.is_correct).length;
    if (correctCount !== 1) {
      return { valid: false, reason: 'Must select exactly 1 correct answer' };
    }
    if (!q.marks || q.marks <= 0) {
      return { valid: false, reason: 'Marks must be greater than 0' };
    }
    return { valid: true };
  };

  const handleUpdateCurrent = (updated: Partial<ExamQuestion>) => {
    const nextList = [...questions];
    nextList[activeIdx] = { ...currentQ, ...updated };
    onChange(nextList);
  };

  const handleAddQuestion = () => {
    const newQ: ExamQuestion = {
      id: crypto.randomUUID(),
      exam_id: currentQ.exam_id,
      question_text: '',
      explanation: '',
      marks: 1,
      difficulty: 'MEDIUM',
      topic: '',
      position: questions.length + 1,
      options: [
        { id: crypto.randomUUID(), question_id: '', option_key: 'A', option_text: '', position: 1, is_correct: true },
        { id: crypto.randomUUID(), question_id: '', option_key: 'B', option_text: '', position: 2, is_correct: false },
        { id: crypto.randomUUID(), question_id: '', option_key: 'C', option_text: '', position: 3, is_correct: false },
        { id: crypto.randomUUID(), question_id: '', option_key: 'D', option_text: '', position: 4, is_correct: false },
      ],
    };
    const nextList = [...questions, newQ];
    onChange(nextList);
    setActiveIdx(nextList.length - 1);
  };

  const handleDuplicateQuestion = () => {
    const dup: ExamQuestion = {
      ...currentQ,
      id: crypto.randomUUID(),
      position: questions.length + 1,
      options: currentQ.options.map(o => ({
        ...o,
        id: crypto.randomUUID(),
      })),
    };
    const nextList = [...questions, dup];
    onChange(nextList);
    setActiveIdx(nextList.length - 1);
  };

  const handleDeleteQuestion = (idxToDelete: number) => {
    if (questions.length <= 1) {
      alert('An exam must contain at least one question.');
      return;
    }
    const nextList = questions.filter((_, idx) => idx !== idxToDelete);
    // Re-index position
    nextList.forEach((q, i) => {
      q.position = i + 1;
    });
    onChange(nextList);
    setActiveIdx(Math.max(0, idxToDelete - 1));
  };

  const handleMoveQuestion = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= questions.length) return;
    const nextList = [...questions];
    const item = nextList.splice(fromIdx, 1)[0];
    nextList.splice(toIdx, 0, item);
    nextList.forEach((q, i) => {
      q.position = i + 1;
    });
    onChange(nextList);
    setActiveIdx(toIdx);
  };

  const handleSetCorrectOption = (optId: string) => {
    const nextOptions = currentQ.options.map(o => ({
      ...o,
      is_correct: o.id === optId,
    }));
    handleUpdateCurrent({ options: nextOptions });
  };

  const handleOptionTextChange = (optId: string, text: string) => {
    const nextOptions = currentQ.options.map(o =>
      o.id === optId ? { ...o, option_text: text } : o
    );
    handleUpdateCurrent({ options: nextOptions });
  };

  const handleAddOption = () => {
    if (currentQ.options.length >= 6) return;
    const nextKey = OPTION_KEYS[currentQ.options.length] || 'X';
    const newOpt: ExamQuestionOption = {
      id: crypto.randomUUID(),
      question_id: currentQ.id,
      option_key: nextKey,
      option_text: '',
      position: currentQ.options.length + 1,
      is_correct: false,
    };
    handleUpdateCurrent({ options: [...currentQ.options, newOpt] });
  };

  const handleRemoveOption = (optId: string) => {
    if (currentQ.options.length <= 2) {
      alert('Questions must have at least 2 options.');
      return;
    }
    let nextOptions = currentQ.options.filter(o => o.id !== optId);
    // Re-assign keys and position
    nextOptions = nextOptions.map((o, idx) => ({
      ...o,
      option_key: OPTION_KEYS[idx],
      position: idx + 1,
    }));
    // If we removed the correct option, default first option as correct
    if (!nextOptions.some(o => o.is_correct)) {
      nextOptions[0].is_correct = true;
    }
    handleUpdateCurrent({ options: nextOptions });
  };

  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const invalidCount = questions.filter(q => !isQuestionValid(q).valid).length;

  return (
    <div className="space-y-4">
      {/* Top Overview Banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Questions:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
              {questions.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calculated Marks:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-200">
              {totalMarks} pts
            </span>
          </div>
          {invalidCount > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>{invalidCount} incomplete question{invalidCount > 1 ? 's' : ''} (action required before publish)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>All questions valid</span>
            </div>
          )}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Question Navigator Palette */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Question List</span>
            <span className="text-[11px] text-slate-400 font-medium">{questions.length} Total</span>
          </div>

          <div className="max-h-[520px] overflow-y-auto space-y-1.5 pr-1">
            {questions.map((q, idx) => {
              const check = isQuestionValid(q);
              const isActive = idx === activeIdx;
              return (
                <div
                  key={q.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-bold shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-extrabold shrink-0 ${
                      isActive ? 'bg-bce-navy text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[150px]">
                      {q.question_text.trim() || <span className="text-slate-400 italic">Untitled question</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      {q.marks}m
                    </span>
                    {check.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <span title={check.reason}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-bce-navy rounded-xl text-xs font-bold text-slate-600 hover:text-bce-navy hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Question</span>
            </button>
          )}
        </div>

        {/* Right Side: Active Question Editor */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          {/* Question Header & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-bce-navy bg-slate-100 px-2.5 py-1 rounded-xl">
                Question {activeIdx + 1} of {questions.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={activeIdx === 0 || readOnly}
                  onClick={() => handleMoveQuestion(activeIdx, activeIdx - 1)}
                  title="Move question up"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={activeIdx === questions.length - 1 || readOnly}
                  onClick={() => handleMoveQuestion(activeIdx, activeIdx + 1)}
                  title="Move question down"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDuplicateQuestion}
                  title="Duplicate question"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-bce-navy bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(activeIdx)}
                  title="Delete question"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Question Statement Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Question Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              disabled={readOnly}
              value={currentQ.question_text}
              onChange={e => handleUpdateCurrent({ question_text: e.target.value })}
              placeholder="e.g. Which of the following data structures operates on the First-In, First-Out (FIFO) principle?"
              className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 focus:border-bce-cobalt transition-all resize-y"
            />
          </div>

          {/* Options Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800">
                  Multiple Choice Options <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Select the radio button next to the option that is the single correct answer.
                </p>
              </div>
              {!readOnly && currentQ.options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Option</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {currentQ.options.map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                    opt.is_correct
                      ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Correct Option Radio Button */}
                  <label
                    title="Mark as correct answer"
                    className="flex items-center gap-2 cursor-pointer shrink-0 pl-1"
                  >
                    <input
                      type="radio"
                      name={`correct_q_${currentQ.id}`}
                      disabled={readOnly}
                      checked={opt.is_correct}
                      onChange={() => handleSetCorrectOption(opt.id)}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-xs ${
                      opt.is_correct ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {opt.option_key}
                    </span>
                  </label>

                  {/* Option Text Input */}
                  <input
                    type="text"
                    disabled={readOnly}
                    value={opt.option_text}
                    onChange={e => handleOptionTextChange(opt.id, e.target.value)}
                    placeholder={`Enter text for option ${opt.option_key}...`}
                    className="flex-1 text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-bce-cobalt focus:border-bce-cobalt bg-white"
                  />

                  {/* Delete Option button */}
                  {!readOnly && currentQ.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(opt.id)}
                      title="Remove option"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Marks & Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Marks for Question <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                disabled={readOnly}
                value={currentQ.marks}
                onChange={e => handleUpdateCurrent({ marks: parseFloat(e.target.value) || 1 })}
                className="w-full text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
              />
              <span className="text-[10px] text-slate-400">Default: 1 mark</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty Level</label>
              <select
                disabled={readOnly}
                value={currentQ.difficulty || 'MEDIUM'}
                onChange={e => handleUpdateCurrent({ difficulty: e.target.value as any })}
                className="w-full text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 bg-white"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topic / Tag (Optional)</label>
              <input
                type="text"
                disabled={readOnly}
                value={currentQ.topic || ''}
                onChange={e => handleUpdateCurrent({ topic: e.target.value })}
                placeholder="e.g. Trees, Algorithms"
                className="w-full text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30"
              />
            </div>
          </div>

          {/* Explanation (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Explanation / Answer Rationale <span className="text-slate-400 font-normal">(Shown to students post-exam if permitted)</span>
            </label>
            <textarea
              rows={2}
              disabled={readOnly}
              value={currentQ.explanation || ''}
              onChange={e => handleUpdateCurrent({ explanation: e.target.value })}
              placeholder="e.g. Queues use FIFO (First In First Out), while Stacks use LIFO (Last In First Out)."
              className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-bce-cobalt/30 resize-y"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx(activeIdx - 1)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
            >
              Previous Question
            </button>
            <button
              type="button"
              disabled={activeIdx === questions.length - 1}
              onClick={() => setActiveIdx(activeIdx + 1)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-bce-navy hover:bg-slate-900 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
            >
              Next Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
