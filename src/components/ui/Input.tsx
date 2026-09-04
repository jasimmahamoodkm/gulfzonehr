import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  as?: 'input' | 'textarea';
}

const Input = React.forwardRef<HTMLInputElement & HTMLTextAreaElement, InputProps>(
  ({ label, error, className, as = 'input', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-2">
            {label}
          </label>
        )}
        {as === 'textarea' ? (
          <textarea
            ref={ref as any}
            className={`w-full px-4 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none ${
              error ? 'border-destructive focus:ring-destructive' : ''
            } ${className || ''}`}
            rows={4}
            {...(props as any)}
          />
        ) : (
          <input
            ref={ref}
            className={`w-full px-4 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors ${
              error ? 'border-destructive focus:ring-destructive' : ''
            } ${className || ''}`}
            {...props}
          />
        )}
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
