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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        {as === 'textarea' ? (
          <textarea
            ref={ref as any}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none ${
              error ? 'border-red-500 focus:ring-red-500' : ''
            } ${className || ''}`}
            rows={4}
            {...(props as any)}
          />
        ) : (
          <input
            ref={ref}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              error ? 'border-red-500 focus:ring-red-500' : ''
            } ${className || ''}`}
            {...props}
          />
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
