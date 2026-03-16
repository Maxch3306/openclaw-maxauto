import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
            <Badge
              key={tag}
              variant="default"
              className="gap-1 bg-primary/15 text-primary border-0"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="hover:opacity-70"
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder={placeholder}
        className="bg-background"
      />
      {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
    </div>
  );
}
