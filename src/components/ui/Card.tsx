import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, header, footer, children, noPadding = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden ${className || ''}`}
        {...props}
      >
        {header && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            {header}
          </div>
        )}
        <div className={noPadding ? '' : 'px-6 py-4'}>
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
