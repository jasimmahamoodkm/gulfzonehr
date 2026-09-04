import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'font-medium rounded-lg transition-colors duration-200 flex items-center gap-2';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const variantStyles = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
      success: 'bg-chart-3 text-primary-foreground hover:bg-chart-3/90 active:bg-chart-3/80',
      outline: 'border-2 border-primary text-primary hover:bg-accent active:bg-accent/80',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className || ''}`}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;
