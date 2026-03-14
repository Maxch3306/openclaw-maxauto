import { X } from "lucide-react";
import { useState } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  validate?: (value: string) => string | null;
}

export function TagInput({ tags, onChange, placeholder, validate }: TagInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addTag() {
    const value = input.trim();
    if (!value) return;
    if (tags.includes(value)) {
      setError("Already added");
      return;
    }
    if (validate) {
      const msg = validate(value);
      if (msg) { setError(msg); return; }
    }
    onChange([...tags, value]);
    setInput("");
    setError(null);
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="hover:opacity-70"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      {error && <p className="text-[10px] text-[var(--color-error)] mt-1">{error}</p>}
    </div>
  );
}
