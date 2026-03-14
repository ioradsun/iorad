import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ClearableInputProps extends React.ComponentProps<typeof Input> {
  onClear?: () => void;
}

const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          value={value}
          className={cn(hasValue && "pr-8", className)}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-foreground/25 hover:text-foreground/50 transition-colors"
            tabIndex={-1}
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  },
);
ClearableInput.displayName = "ClearableInput";

export { ClearableInput };
